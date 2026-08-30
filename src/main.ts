import "./styles/main.css";

import {
  education,
  experience,
  profile,
  projects,
  sideProjects,
  skills,
  type ProjectLink,
} from "./content";
import { createParticleField } from "./scene/particleField";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in the document`);
  return node as T;
}

// ---------------------------------------------------------------- content ---

function renderHero() {
  const host = need("hero-intro");
  for (const paragraph of profile.intro) {
    host.append(el("p", undefined, paragraph));
  }
}

/**
 * Cards carry more than one destination now (a site and an App Store listing),
 * so the links live in their own row rather than wrapping the whole card.
 */
function linkRow(links: ProjectLink[], className: string): HTMLElement {
  const row = el("div", className);
  for (const link of links) {
    const anchor = el("a", undefined);
    anchor.href = link.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.append(el("span", undefined, link.label), el("span", "link__go", "↗"));
    row.append(anchor);
  }
  return row;
}

function renderProjects() {
  const host = need("projects");

  projects.forEach((project, index) => {
    const card = el("article", "project reveal");
    card.style.setProperty("--accent", project.accent);
    card.style.setProperty("--stagger", `${index * 70}ms`);

    const head = el("div", "project__head");

    const badge = el("div", "project__badge");
    if (project.icon) {
      const img = el("img");
      img.src = project.icon;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      badge.append(img);
    } else {
      badge.classList.add("project__badge--letter");
      badge.textContent = project.name.charAt(0);
    }

    const titles = el("div", "project__titles");
    titles.append(
      el("h3", "project__name", project.name),
      el("p", "project__tagline", project.tagline),
    );

    head.append(badge, titles);

    const stack = el("ul", "project__stack");
    for (const tech of project.stack) {
      stack.append(el("li", undefined, tech));
    }

    card.append(head, el("p", "project__body", project.description), stack);
    if (project.links.length) {
      card.append(linkRow(project.links, "project__links"));
    }
    host.append(card);
  });
}

function renderSideProjects() {
  const host = need("side-projects");

  sideProjects.forEach((project, index) => {
    const card = el("article", "aside-card reveal");
    card.style.setProperty("--stagger", `${index * 70}ms`);

    card.append(
      el("h4", "aside-card__name", project.name),
      el("p", "aside-card__body", project.description),
    );

    const stack = el("ul", "aside-card__stack");
    for (const tech of project.stack) {
      stack.append(el("li", undefined, tech));
    }
    card.append(stack);

    if (project.links.length) {
      card.append(linkRow(project.links, "aside-card__links"));
    }
    host.append(card);
  });
}

function renderExperience() {
  const host = need("timeline");

  experience.forEach((job, index) => {
    const item = el("article", "job reveal");
    item.style.setProperty("--stagger", `${index * 90}ms`);

    const head = el("div", "job__head");
    head.append(
      el("h3", "job__role", job.role),
      el("p", "job__org", job.org),
      el("p", "job__period", job.period),
    );

    const list = el("ul", "job__bullets");
    for (const bullet of job.bullets) {
      list.append(el("li", undefined, bullet));
    }

    item.append(head, list);
    host.append(item);
  });

  const eduHost = need("education");
  eduHost.append(
    el("p", "education__label", "Education"),
    el("h3", "education__school", education.school),
    el("p", "education__degree", education.degree),
    el("p", "education__period", education.period),
  );
}

function renderSkills() {
  const host = need("skills-grid");

  skills.forEach((group, index) => {
    const block = el("div", "skill-group reveal");
    block.style.setProperty("--stagger", `${index * 80}ms`);
    block.append(el("h3", "skill-group__label", group.label));

    const list = el("ul", "skill-group__items");
    for (const item of group.items) {
      list.append(el("li", undefined, item));
    }

    block.append(list);
    host.append(block);
  });
}

function renderContact() {
  const email = need<HTMLAnchorElement>("contact-email");
  email.href = `mailto:${profile.email}`;
  email.textContent = profile.email;

  const host = need("contact-links");
  const entries: Array<[string, string]> = [
    ["GitHub", profile.links.github],
    ["LinkedIn", profile.links.linkedin],
    ["Instagram", profile.links.instagram],
  ];

  for (const [label, href] of entries) {
    const link = el("a", undefined, label);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    host.append(link);
  }
}

// ----------------------------------------------------------------- motion ---

function watchReveals() {
  const targets = document.querySelectorAll<HTMLElement>(".reveal");

  // Without the observer, content must still be readable rather than stuck at
  // opacity 0.
  if (!("IntersectionObserver" in window)) {
    for (const node of targets) node.classList.add("is-visible");
    return;
  }

  /**
   * A small fixed inset rather than a percentage. A percentage margin scales
   * with the viewport, so on a short window it combined with a 5% threshold to
   * leave a dead band at the bottom of the page where an element could sit
   * fully on screen and still never reveal. The contact email landed in it.
   */
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -48px 0px", threshold: 0 },
  );

  for (const node of targets) {
    observer.observe(node);
  }
}

/**
 * One scroll listener drives both the progress bar and the WebGL morph, so
 * they can never disagree about where the page is.
 */
function watchScroll(onProgress: (progress: number) => void) {
  const bar = need("scroll-bar");
  let queued = false;

  const measure = () => {
    queued = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
    const clamped = Math.min(Math.max(progress, 0), 1);
    bar.style.transform = `scaleX(${clamped})`;
    onProgress(clamped);
  };

  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    },
    { passive: true },
  );
  window.addEventListener("resize", measure);
  measure();
}

function dismissLoader() {
  const loader = need("loader");
  loader.classList.add("is-done");
  window.setTimeout(() => loader.remove(), 900);
}

// ------------------------------------------------------------------- boot ---

renderHero();
renderProjects();
renderSideProjects();
renderExperience();
renderSkills();
renderContact();
watchReveals();

const canvas = need<HTMLCanvasElement>("field");
const field = createParticleField(canvas);

if (field) {
  watchScroll((progress) => field.setScrollProgress(progress));
} else {
  // No WebGL: the CSS backdrop carries the page on its own.
  document.body.classList.add("no-webgl");
  canvas.remove();
  watchScroll(() => {});
}

// Give the first frames a moment to land before uncovering the page.
window.setTimeout(dismissLoader, field ? 700 : 200);
