import { createRoot } from "react-dom/client";
import "./index.css";

console.log("[DIAG] main.tsx loaded");

// Global runtime error surfaces to avoid blank page with silent failure
function showFatal(err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error("[FATAL] App bootstrap error:", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="max-width:960px;margin:3rem auto;padding:1.25rem;border:1px solid #fbbf24;background:#fef3c7;border-radius:8px;font-family:ui-sans-serif,system-ui">
        <h2 style="margin:0 0 .5rem 0;color:#b91c1c">App failed to start</h2>
        <div style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;color:#111827">${msg}</div>
        <p style="margin-top:.75rem;color:#374151">Open the browser console and share the full stack trace so we can pinpoint the module causing this.</p>
      </div>`;
  }
}

window.addEventListener("error", (ev) => {
  showFatal(ev.error || ev.message);
});
window.addEventListener("unhandledrejection", (ev) => {
  // Some bundlers wrap errors; try different fields
  // @ts-expect-error - non-standard
  const reason = ev.reason || ev.detail || ev;
  showFatal(reason);
});

// Dynamically import App so module-evaluation errors are catchable
import("./App")
  .then(({ default: App }) => {
    const rootEl = document.getElementById("root");
    if (!rootEl) return showFatal("Missing #root element");
    createRoot(rootEl).render(<App />);
    console.log("[DIAG] React App mounted");
  })
  .catch((err) => {
    showFatal(err);
  });

// PWA Service Worker Registration
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      console.log('New content available, please refresh.');
    },
    onOfflineReady() {
      console.log('App is ready to work offline.');
      // Optional: Display a toast here "Ready for offline use"
    },
  });
}
