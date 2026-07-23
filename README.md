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

## Phase 3: source-grounded learning drafts

Every fetched Fellow training preview includes a review-first Learning Draft Studio. It can prepare prompts for mixed flashcards, Trial Cards, five-option quiz questions, and Board Trap cards.

The conversion workflow is intentionally gated:

1. Build a prompt from the read-only Notion page, deterministic auto-tags, and conservative related-question links.
2. Generate JSON outside the Tracker and paste it back into the studio.
3. Validate the schema and require `sourceEvidence` for every item.
4. Preview the drafts and skip existing or within-batch duplicates.
5. Add only explicitly approved items to Card Manager or Question Manager.

Generated items retain the Notion page ID, URL, title, and source evidence. The Tracker never changes the source page or its `Flashcard` checkbox; instead it separately displays the number of locally linked cards.

## NEWS and Phase 3 integration

NEWS and Knowledge now share the same authenticated `/api/notion-library` index, local cache, sync status, and on-demand note preview. NEWS ranks that shared index against the selected 100-Day Plan task in the browser; it no longer has a separate Notion API route.

Cancer domains, Notion cancer values, treatment settings, drug terms, and note tags are defined once in `src/data/notionTaxonomy.js`. The same definitions drive NEWS matching, Knowledge topic links, and Phase 3 namespaced auto-tags. Current plan labels such as `Other` and legacy module labels such as `Rare/Skin/Sarcoma/CUP/Other` resolve through the same mapping.

From a NEWS story, `Preview & create` opens the same read-only preview and Learning Draft Studio used by Knowledge. A bundled metadata snapshot remains only as a first-run/offline display fallback; all live Notion reads go through the authenticated Library endpoint.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
