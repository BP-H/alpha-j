# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

While this project uses React, Vite supports many popular JS frameworks. [See all the supported frameworks](https://vitejs.dev/guide/#scaffolding-your-first-vite-project).

## Environment Variables

Fetching images from Unsplash or Pexels requires API keys. Set the following variables in your environment:

- `VITE_UNSPLASH_KEY` – Unsplash access key
- `VITE_PEXELS_KEY` – Pexels API key

The app reads these values from `import.meta.env` and falls back to any keys stored in the in-memory secure store for local testing.

### Adding keys on Vercel

1. Open your project on [Vercel](https://vercel.com).
2. Navigate to **Settings → Environment Variables**.
3. Add `VITE_UNSPLASH_KEY` and `VITE_PEXELS_KEY` with their respective values.
4. Redeploy your project to apply the new variables.

## Deploy Your Own

Deploy your own Vite project with Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vercel/examples/tree/main/framework-boilerplates/vite-react&template=vite-react)

_Live Example: https://vite-react-example.vercel.app_

### Deploying From Your Terminal

You can deploy your new Vite project with a single command from your terminal using [Vercel CLI](https://vercel.com/download):

```shell
$ vercel
```

## Viewing Console Errors on Vercel

When debugging a production deployment, you can inspect runtime errors in two ways:

1. Open your deployed site in the browser and use the browser's developer tools (**Console** tab) to see client-side errors.
2. Visit your project on Vercel and open the **Logs** tab or run `vercel logs <deployment-url>` from the CLI to view server-side console output.

## Demo posts

To preview the sample posts included in [`src/lib/placeholders.ts`](src/lib/placeholders.ts) after deploying to Vercel:

1. In your Vercel dashboard, open **Project Settings → Environment Variables** and add `VITE_DEMO` with a value of `1`.
2. Redeploy the project.

When `VITE_DEMO=1` is set, the app displays the placeholder posts defined in `src/lib/placeholders.ts`.

## Model Viewer integrity

The app loads `@google/model-viewer` at runtime with a Subresource Integrity (SRI) check.
If the CDN copy fails to load, a vetted fallback bundled at
`public/vendor/model-viewer.min.js` is used instead.

To regenerate the SRI hash after upgrading `model-viewer`:

1. Download the package and extract the bundle:

   ```bash
   npm pack @google/model-viewer@<version> --silent
   tar -xzf google-model-viewer-<version>.tgz
   ```

2. Compute the SHA‑384 hash:

   ```bash
   openssl dgst -sha384 -binary package/dist/model-viewer.min.js | openssl base64 -A
   ```

3. Prefix the result with `sha384-` and update `REMOTE_SRI` in
   [`src/lib/ensureModelViewer.ts`](src/lib/ensureModelViewer.ts).
4. Replace `public/vendor/model-viewer.min.js` with the new build.
