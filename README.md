# Sourwater

Source for [sourwater.space](https://sourwater.space), deployed as the
`sourwater` Cloudflare Worker.

## Local build

```bash
npm install
npm run build
```

The build copies both English and Greek pages into `dist/` and captures the
site's current image assets before deployment. This keeps the previously
dashboard-only site reproducible from GitHub.

## Cloudflare

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
