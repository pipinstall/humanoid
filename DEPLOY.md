# Deploying to GitHub Pages

The site is a static build — `python3 scripts/build_site.py` writes everything to `dist/`.
A GitHub Action (`.github/workflows/pages.yml`) runs that on every push to `main` and publishes
`dist/` to GitHub Pages. No Node, no external services.

## One-time setup (your side)

1. **Create an empty GitHub repository** — no README, no `.gitignore`, no license (this repo
   already has all three). Name it whatever you like, e.g. `humanoid-robot-index`.

2. **Give me the URL** (or run it yourself):

   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

3. **Turn on Pages**: repo → **Settings → Pages → Build and deployment → Source: “GitHub Actions”**.
   The first push (step 2) will have already triggered a run; re-run it from the **Actions** tab
   if it fired before you flipped the switch.

Within a minute or two the site is live at `https://<you>.github.io/<repo>/`.
Every later `git push` rebuilds and redeploys automatically.

## After it's live

- Put the real URL in `site/config.json` so per-robot pages emit absolute `canonical` and
  `og:image` tags (better link previews):

  ```json
  { "base_url": "https://<you>.github.io/<repo>" }
  ```

  then commit — the next deploy picks it up.

- **Custom domain**: add a file `site/CNAME` containing just the domain (e.g. `humanoids.example.com`),
  commit, and point a DNS `CNAME` record at `<you>.github.io`. Set it in Settings → Pages too.

## Local preview

```bash
python3 scripts/build_site.py
python3 -m http.server -d dist 8000
# open http://localhost:8000/
```

## Images

Robot photos are **committed** under `site/img/` (they are not fetched in CI). To add or refresh
them:

```bash
python3 scripts/fetch_images.py            # fetches CC/PD images for the curated list
python3 scripts/fetch_images.py --only unitree-g1   # just one
```

Review the downloads, then `git add site/img site/credits.json` and push.
