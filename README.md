# React + Vite

## Phase 2: Fellow training read-only connector

The Knowledge Hub can index the existing Notion `Fellow training` data source through `/api/notion-library`.
Notion remains the source of truth: the endpoint accepts `GET` only and never creates or updates Notion pages.

Configure these server-side environment variables in Vercel (see `.env.example`):

- `NOTION_TOKEN`
- `NOTION_DATA_SOURCE_ID`
- `NOTION_ALLOWED_UIDS` or `NOTION_ALLOWED_EMAILS`
- optionally `NOTION_VERSION` and `FIREBASE_WEB_API_KEY`

At least one allow-list variable is required. Requests must also include a valid Firebase ID token from the signed-in Cloud Sync user. The browser never receives `NOTION_TOKEN`.

The client keeps normalized library metadata in local storage for offline fallback and keeps fetched page previews in session storage only. `Sync now` refreshes the index; previews are fetched on demand and rendered as plain text with a table of contents.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
