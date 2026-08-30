/**
 * Renders resume/resume.html to public/Resume.pdf.
 *
 * The HTML is the source of truth; the PDF is a build artifact that happens to
 * be committed so the live site can serve it. Edit the HTML, run
 * `npm run resume`, commit both.
 *
 *   node resume/render.mjs
 */
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import puppeteer from "puppeteer";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "resume.html");
const output = join(here, "..", "public", "Resume.pdf");

await mkdir(dirname(output), { recursive: true });

const browser = await puppeteer.launch({ headless: true });

try {
  const page = await browser.newPage();

  // `networkidle0` matters because the stylesheet is inline but fonts are not:
  // rendering before they settle produces a PDF with the fallback metrics.
  await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle0" });
  await page.evaluateHandle("document.fonts.ready");

  await page.pdf({
    path: output,
    format: "letter",
    printBackground: true,
    // Margins live in the stylesheet's @page rule so the HTML preview and the
    // PDF agree; overriding them here would silently double up.
    preferCSSPageSize: true,
  });

  const { size } = await stat(output);

  // Count page objects in the PDF itself. Estimating from scrollHeight ignores
  // the @page margins and quietly reports one page when it is really two.
  const pdf = await readFile(output, "latin1");
  const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;

  console.log(
    `Resume.pdf written: ${(size / 1024).toFixed(0)} KB, ${pages} page${pages === 1 ? "" : "s"}`,
  );

  if (pages !== 1) {
    console.warn(
      `Warning: a résumé should be one page. Tighten resume/resume.html.`,
    );
  }
} finally {
  await browser.close();
}
