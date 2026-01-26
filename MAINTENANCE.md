# MAINTAINER GUIDE (Antigravity Patches)

This document contains essential instructions for maintaining this codebase and applying patches correctly across different environments.

## Core Setup (Crucial)

To ensure the system remains stable and performant:

1.  **Environment Mode**: ALWAYS run the server in production mode for daily use.
    - Set `NODE_ENV=production` in `.env`.
    - This disables the heavy Vite development server and serves static, optimized assets.
2.  **Product Images**: Images are stored in `dist/public/uploads/products`. 
    - If you are setting up a new machine, ensure this directory exists and has write permissions.

## Recent Patches

- **ESM Compatibility**: Fixed several `ReferenceError: module is not defined` issues by switching to dynamic imports for dev plugins in `vite.config.ts` and `server/vite.ts`.
- **Runtime Path Resolution**: Replaced `import.meta.dirname` with `process.cwd()` to prevent crashes in the compiled CommonJS bundle.
- **Image Performance**: Added `loading="lazy"` to all product image renders and implemented robust error fallbacks across all dashboards.

## How to Check Performance

If the system feels sluggish:

1.  **Browser DevTools**:
    - Open Chrome/Firefox DevTools (F12).
    - Go to the **Network** tab. Ensure API requests (e.g., `/api/products`) are taking less than 200ms.
    - Go to the **Lighthouse** tab and run a performance report.
2.  **React Profiling**:
    - Use the React Developer Tools "Profiler" tab to identify components that are re-rendering excessively.
3.  **Server Logs**:
    - Check `server.log` for any "Uncaught Exception" or slow DB connection warnings.

## Deployment Command

To apply all changes and restart the server cleanly:

```bash
npm run build && fuser -k 5003/tcp || true && export $(cat .env | grep -v '^#' | xargs) && node dist/index.cjs > server.log 2>&1 &
```

---
*Created for Antigravity AI Collaborators.*
