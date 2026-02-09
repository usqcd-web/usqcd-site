# USQCD Prototype Site (Vite + React + Tailwind)

This repository is a prototype static site for the USQCD collaboration. It includes a React + Tailwind frontend, sample data files, and a script to fetch publications from arXiv.

## Quick start (local)

```bash
# Install
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview built site
npm run preview
```

## Deploy to Vercel (recommended)

1. Create a new project in Vercel and connect your GitHub repository (or import the ZIP).
2. Set the root to the repository root. Vercel will auto-detect Vite.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment: ensure Node 18+
6. Deploy — Vercel will build and host the site.

## Deploy to Netlify

1. Create a new site and connect to your GitHub repository or upload the ZIP.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add a deploy hook if you want to trigger rebuilds from CI.
5. Deploy the site.

## Deploy to GitHub Pages

1. Build locally: `npm run build`
2. Push the contents of `dist/` to the `gh-pages` branch.
   ```bash
   npm run build
   git checkout --orphan gh-pages
   git --work-tree dist add --all
   git --work-tree dist commit -m "Deploy"
   git push origin HEAD:gh-pages --force
   git checkout -
   ```
3. Configure repository Settings > Pages to serve from `gh-pages` branch (root).

## Updating publications automatically (GitHub Actions)

The included workflow `.github/workflows/update-publications.yml` runs daily and executes `scripts/fetch_arxiv.py` to update `static/data/publications.json`. It commits the result back to the repository.

## Notes

- The arXiv fetch script relies on matching author names to the membership list; refine as needed.
- Verify image attributions and licensing before production.
