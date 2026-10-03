# daniilzinovyev.com

Personal site. Vite + TypeScript + Three.js on the front, AWS CDK underneath.

```bash
npm install
npm run dev          # local dev server
npm run deploy       # build the site and push it live
```

## Layout

```
index.html            page shell
src/
  content.ts          projects, experience, skills — edit facts here
  main.ts             renders the content and boots the scene
  scene/
    particleField.ts  renderer, camera, bloom, scroll wiring
    formations.ts     the four layouts the field morphs between
    shaders.ts        GLSL for the particles
  styles/main.css
resume/
  resume.html         the résumé source
  render.mjs          renders it to public/Resume.pdf
public/               copied to the site root as-is
infra/                AWS CDK app
```

## The WebGL field

One `Points` mesh of up to 130k particles. Each particle carries four "home"
positions — a spiral galaxy, a sphere, a torus knot, and a wave grid — and a
uniform walks from 0 to 3 as the page scrolls, so the field morphs between them
continuously. Drift comes from simplex noise in the vertex shader, and the
cursor pushes particles out of the way in world space.

The particle count scales down on narrow screens and low core counts,
`prefers-reduced-motion` slows it to a near-still drift, and if WebGL is missing
the canvas is removed and a CSS gradient carries the page.

## Résumé

`resume/resume.html` is the source; `public/Resume.pdf` is a build artifact that
is committed so the live site can serve it.

```bash
npm run resume       # re-render the PDF (warns if it spills past one page)
```

`npm run build` runs this automatically, so a deploy never ships a stale PDF.

To publish a supplied PDF directly, copy it to `public/Resume.pdf`, then upload
only that file using the `personal` AWS profile:

```bash
cp /path/to/Resume.pdf public/Resume.pdf
aws --profile personal s3 cp public/Resume.pdf s3://daniilzinovyev.com/Resume.pdf --content-type application/pdf
aws --profile personal cloudfront create-invalidation --distribution-id E3FG7G20EJZ8OE --paths /Resume.pdf
```

The existing résumé buttons serve `https://www.daniilzinovyev.com/Resume.pdf`.
This direct upload preserves the supplied PDF exactly. A subsequent full build
regenerates it from `resume/resume.html`, so keep that source in sync before a
full-site deployment.

## Infrastructure

| | |
|---|---|
| Bucket | `daniilzinovyev.com`, S3 website hosting |
| CDN | CloudFront `E3FG7G20EJZ8OE`, aliases `daniilzinovyev.com` and `www.` |
| TLS | ACM certificate in us-east-1, referenced by ARN |
| DNS | **Namecheap, not Route 53** |

DNS lives at the registrar: the apex is a Namecheap URL forward to `www`, and
`www` is a CNAME to the CloudFront distribution. CDK does not manage it, which
is also why the certificate is referenced by ARN rather than created — CDK
cannot write the validation records, so an ACM replacement would silently need
a manual step. Rotating it is documented in `infra/lib/website-stack.ts`.

### Deploying

```bash
npm run deploy
```

That builds the résumé, type-checks, builds the site, then runs `cdk deploy`,
which uploads `dist/`, prunes anything no longer in the build, and invalidates
the CDN.

To see what would change first:

```bash
npm run infra:diff
```

### One-time setup, already done

The bucket and distribution existed before this stack did, so they were adopted
rather than recreated:

```bash
npx cdk bootstrap aws://104994162766/us-east-1
cd infra && npm run import      # uses resource-mapping.json
```

A CloudFormation import changeset may contain nothing but `IMPORT` actions,
which is why `npm run import` passes `--context importMode=true` — that flag
drops the deployment Lambda and the extra cache policy from the template for
that one run. Normal deploys leave it off. You should not need either command
again.
