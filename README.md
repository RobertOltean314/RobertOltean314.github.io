# robertoltean314.github.io

Personal portfolio — a single static page backed by live GitHub data.

**No build step, no dependencies, no framework.** Plain HTML, CSS and one JS file.
It deploys anywhere that serves static files (GitHub Pages, Vercel, Netlify, any web server).

---

## Structure

```
index.html                        all page content — edit copy here
assets/css/styles.css             all styling; palette lives in :root
assets/js/app.js                  GitHub data layer, repo grid, nav
assets/data/github-snapshot.json  generated fallback data — do not edit by hand
scripts/refresh-github-data.sh    regenerates the snapshot
```

## How the GitHub data works

Two layers, so the page is never blank and never badly stale:

1. **Live** — on load the page calls the public GitHub API (2 unauthenticated
   requests) for the profile and repository list. Stars, descriptions and
   "updated N ago" are always current. The response is cached in `localStorage`
   for one hour so repeat visits cost nothing.
2. **Snapshot** — `assets/data/github-snapshot.json` is committed to the repo.
   It supplies the per-repository language byte counts (computing those live
   would need ~30 extra API calls), and it takes over entirely if the API is
   unreachable or the visitor has hit the 60-requests-per-hour limit.

The card in the hero states which source is in use.

### Refreshing the snapshot

```bash
./scripts/refresh-github-data.sh
```

Needs the [GitHub CLI](https://cli.github.com) authenticated (`gh auth login`).
A scheduled workflow in `.github/workflows/` also runs this weekly.

## Editing the content

All prose lives directly in `index.html` — it is deliberately not loaded from
JSON, so the page is fully crawlable by search engines and readable with
JavaScript disabled.

| To change | Edit |
|---|---|
| Bio, experience, education | the `#about` and `#experience` sections |
| Featured projects | the `#projects` section — each card is one `<article class="feat">` |
| Skills groups | the `#skills` section |
| Colors | the `:root` block at the top of `styles.css` |
| Which repos are hidden from the grid | `CONFIG.hideFromGrid` in `app.js` |
| Which repos are excluded from the language chart | `CONFIG.excludeFromLangStats` in `app.js` |

Adding a featured card: copy an existing `<article class="feat">`, set
`data-repo` to the repository name and `--accent` to a color. The GitHub stats
line fills itself in from `data-repo`.

## Running locally

Open a local server — `file://` will not work, because the page fetches JSON.

```bash
node .claude/serve.js
```

Then visit <http://localhost:4321>.

## Deploying

### GitHub Pages

The repository must be named `RobertOltean314.github.io` to publish at the root
domain. (This is a *different* repository from `RobertOltean314`, which holds
the profile README.)

```bash
gh repo create RobertOltean314.github.io --public --source=. --remote=origin --push
```

Then in **Settings → Pages**, set Source to `Deploy from a branch`, branch
`main`, folder `/ (root)`. The site appears at
`https://robertoltean314.github.io/` within a minute or two.

### Vercel

Import the repository at [vercel.com/new](https://vercel.com/new). Framework
preset **Other**, build command empty, output directory `.`. Static sites are
free on the hobby tier.

### Custom domain (robertoltean.ro)

Point the domain at whichever host you keep. For GitHub Pages, add a `CNAME`
file containing `robertoltean.ro` and configure DNS per
[GitHub's guide](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site).

## Notes

- Contact details on the page are the email and phone from the CV. A public
  page does get scraped by bots; to remove the phone later, delete the
  `.contact__phone` line in the `#contact` section of `index.html` and the
  `telephone` field in the JSON-LD block in `<head>`.
- `first-test-repository` is excluded from the language chart via
  `CONFIG.excludeFromLangStats` in `app.js`: it is a vendored NXP MCUXpresso
  SDK (~11.8 MB of third-party C) that would otherwise show as ~75% of "your"
  code. The exclusion is deliberately not mentioned on the page itself.
- Forks and the `RobertOltean314` / `CV` repositories are hidden from the grid.
