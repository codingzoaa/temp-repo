# Cloudflare market collector

GitHub repository: codingzoaa/temp-repo. Worker: market-brief-api.

## Git integration deployment

In Cloudflare Workers Builds settings, choose this repository and main branch.
Set the root directory to `worker`, build command to `npm install`, and deploy command to `npx wrangler deploy`.
`wrangler.jsonc` defines the entry point, allowed website origin and 15-minute Cron Trigger.
Retain the existing `TWELVE_DATA_API_KEY` **Worker runtime Secret** (not only a build environment variable).
Never commit the key.

After the first deployment, create a Workers KV namespace named `market-brief-cache`.
Open the Worker → Bindings → Add binding → KV namespace, choose that namespace and set the binding name to `MARKET_CACHE`. Apply/deploy the binding changes.
For subsequent Git deployments, copy the namespace ID into this configuration's top-level field:

```json
"kv_namespaces": [{"binding": "MARKET_CACHE", "id": "YOUR_NAMESPACE_ID"}]
```

The namespace ID is public configuration, not the API secret. Keep it in wrangler.jsonc so future deployments preserve the binding.

Check `https://market-brief-api.kby0991.workers.dev/api/health`: `configured` must be true.
The first `/api/market` collection occurs on the next 15-minute boundary during US regular hours (09:30–16:15 America/New_York). Before that it returns 503 with an initialization message. DST is handled using the New York timezone. Holidays are not detected; provider timestamps still identify previous observations. Browser polling never calls Twelve Data and never exposes the API key.

The collector makes four sequential quote requests each scheduled collection, no more than 112 requests across a full scheduled trading day, excluding holiday behavior and manual trigger tests. Confirm your account's credits and display/redistribution rights. If symbols are not available under your plan, they show unavailable or the last saved observation; no substitute prices are invented. It requests ETF quotes, not the S&P/Nasdaq/Dow index levels.

`/api/market` is public, GET-only and returns cached quotes, timestamps, sanitized warnings and stale status. CORS allows the GitHub Pages origin only; CORS is not authentication. Last successful per-symbol data survives provider errors. A collection failure does not expose provider responses or secrets. KV is eventually consistent; small propagation delays are expected. Website polling is once per minute while visible.

Run tests: `node --test worker/test.mjs` from the repository root.
