# Northstar Market

A local-first marketplace of ready-to-explore website demos. Each template is a complete, multi-page static website you can open and customise — free for testing.

## What's inside

- `index.html` — the storefront that showcases six website concepts.
- `templates/` — 24 static demo pages across six brands (Portfolio, SaaS, Shop, Food, Agency, Events).
- `updates.json` — version manifest used by the optional update-checker demo.

## Live site

Hosted on GitHub Pages:

https://notknowngamerz.github.io/north-star-market/

## Notes

- All demos are tagged **Demo** and are free to explore locally. There is no buying flow in this testing version.
- To run locally, serve the folder over `localhost` (e.g. `python -m http.server`) rather than opening the file directly, so relative links and `fetch` work.

## Request backend (Cloudflare Worker)

Visitor "Request a website" submissions are stored by a small Cloudflare Worker (`worker/requests.js`) and forwarded to the owner's email.

### Deploy (one-time)

1. Authenticate (opens your browser):
   ```
   npx wrangler login
   ```
2. Create the KV namespace and copy the returned id into `worker/wrangler.toml`:
   ```
   npx wrangler kv namespace create REQUESTS
   ```
3. Deploy:
   ```
   cd worker
   npx wrangler deploy
   ```
4. Copy the Worker URL (e.g. `https://northstar-requests.<subdomain>.workers.dev`) into `REQUEST_API` in `index.html`.

### Automatic deploys

Pushing to `main` runs `.github/workflows/deploy-worker.yml`, which deploys the Worker using a `CF_API_TOKEN` secret (create one with Workers edit rights in the Cloudflare dashboard and add it to the repo's Secrets).

### Viewing submissions

Stored in the KV namespace (`req:<id>` keys, plus an `index` list). Optionally configure a `SEND_EMAIL` binding in the Cloudflare dashboard to also email each submission to `hs9961984@gmail.com`.

