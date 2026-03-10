import { Router, type Request, type Response } from "express";
import { Store } from "./store.js";
import { fetchPublicIndex } from "./index-fetcher.js";

const store = new Store();
const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  const { webId, name } = req.body;
  if (!webId || typeof webId !== "string") {
    res.status(400).json({ error: "webId is required" });
    return;
  }

  const entry = store.register(webId, name);

  // Try to fetch and cache their public index in the background
  if (entry.podUrl) {
    fetchPublicIndex(entry.podUrl).then((index) => {
      if (index) store.updateIndex(webId, index);
    });
  }

  res.json(entry);
});

router.get("/directory", (_req: Request, res: Response) => {
  res.json(store.getAll());
});

router.get("/lookup", (req: Request, res: Response) => {
  const webId = req.query.webId;
  if (!webId || typeof webId !== "string") {
    res.status(400).json({ error: "webId query parameter is required" });
    return;
  }
  const entry = store.get(webId);
  if (!entry) {
    res.status(404).json({ error: "Not registered" });
    return;
  }
  res.json(entry);
});

router.post("/refresh-index", async (req: Request, res: Response) => {
  const { webId } = req.body;
  if (!webId || typeof webId !== "string") {
    res.status(400).json({ error: "webId is required" });
    return;
  }
  const entry = store.get(webId);
  if (!entry) {
    res.status(404).json({ error: "Not registered" });
    return;
  }
  if (!entry.podUrl) {
    res.status(400).json({ error: "No pod URL known for this user" });
    return;
  }
  const index = await fetchPublicIndex(entry.podUrl);
  if (index) {
    store.updateIndex(webId, index);
    res.json(store.get(webId));
  } else {
    res.status(404).json({ error: "Could not fetch public index" });
  }
});

router.get("/search", (req: Request, res: Response) => {
  const q = req.query.q;
  if (!q || typeof q !== "string") {
    res.status(400).json({ error: "q query parameter is required" });
    return;
  }
  res.json(store.search(q));
});

// Dashboard
router.get("/", (_req: Request, res: Response) => {
  const entries = store.getAll();

  const userCards = entries
    .map((e) => {
      const resourceCount = e.index?.resources.length ?? 0;
      const containers = e.index?.resources.filter((r) => r.type === "container").length ?? 0;
      const files = resourceCount - containers;
      const updatedAt = e.index?.updatedAt
        ? new Date(e.index.updatedAt).toLocaleString()
        : "Never";
      const registeredAt = new Date(e.registeredAt).toLocaleString();

      const resourceRows = (e.index?.resources ?? [])
        .slice(0, 50)
        .map(
          (r) =>
            `<tr>
              <td class="mono">${escapeHtml(r.url)}</td>
              <td><span class="badge ${r.type === "container" ? "badge-folder" : "badge-file"}">${r.type}</span></td>
              <td class="mono muted">${escapeHtml(r.contentType ?? "—")}</td>
            </tr>`
        )
        .join("\n");

      const truncatedNote =
        resourceCount > 50
          ? `<p class="muted">Showing 50 of ${resourceCount} resources</p>`
          : "";

      return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>${escapeHtml(e.name ?? "Unnamed User")}</h3>
            <p class="mono muted">${escapeHtml(e.webId)}</p>
          </div>
          <div class="card-meta">
            <span class="stat">${resourceCount} resources</span>
            <span class="stat">${containers} containers</span>
            <span class="stat">${files} files</span>
          </div>
        </div>
        <div class="card-details">
          <p><strong>Pod URL:</strong> <span class="mono">${escapeHtml(e.podUrl ?? "Unknown")}</span></p>
          <p><strong>Registered:</strong> ${escapeHtml(registeredAt)}</p>
          <p><strong>Index updated:</strong> ${escapeHtml(updatedAt)}</p>
        </div>
        ${
          resourceCount > 0
            ? `<details>
              <summary>${resourceCount} indexed resource(s)</summary>
              <div class="resource-table-wrap">
                <table class="resource-table">
                  <tr><th>URL</th><th>Type</th><th>Content-Type</th></tr>
                  ${resourceRows}
                </table>
                ${truncatedNote}
              </div>
            </details>`
            : `<p class="muted">No index published yet.</p>`
        }
      </div>`;
    })
    .join("\n");

  res.type("html").send(`<!DOCTYPE html>
<html><head><title>Discovery Registry</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f8f9fa; color: #1a1a2e; line-height: 1.6; }
  .container { max-width: 1000px; margin: 0 auto; padding: 1.5rem; }
  header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.5rem; }
  h1 { font-size: 1.5rem; color: #2d3748; }
  .header-stats { display: flex; gap: 1.5rem; font-size: 0.9rem; color: #4a5568; }
  .header-stats strong { color: #2d3748; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
  .card-header h3 { font-size: 1.1rem; color: #2d3748; }
  .card-meta { display: flex; gap: 0.75rem; }
  .stat { display: inline-block; background: #ebf8ff; color: #2b6cb0; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; }
  .card-details { font-size: 0.85rem; color: #4a5568; margin-bottom: 0.75rem; }
  .card-details p { margin-bottom: 0.25rem; }
  .mono { font-family: monospace; font-size: 0.8rem; }
  .muted { color: #a0aec0; }
  details { margin-top: 0.5rem; }
  summary { cursor: pointer; font-size: 0.85rem; color: #4299e1; font-weight: 500; padding: 0.25rem 0; }
  summary:hover { color: #3182ce; }
  .resource-table-wrap { max-height: 300px; overflow: auto; margin-top: 0.5rem; }
  .resource-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .resource-table th { text-align: left; padding: 0.4rem 0.5rem; background: #f7fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem; color: #4a5568; text-transform: uppercase; letter-spacing: 0.05em; position: sticky; top: 0; }
  .resource-table td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #f0f0f0; word-break: break-all; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 0.7rem; font-weight: 500; }
  .badge-folder { background: #fefcbf; color: #975a16; }
  .badge-file { background: #e9d8fd; color: #553c9a; }
  .empty { text-align: center; padding: 3rem; color: #a0aec0; }
  @media (max-width: 768px) { .card-header { flex-direction: column; gap: 0.5rem; } .card-meta { flex-wrap: wrap; } }
</style>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div class="container">
  <header>
    <h1>Discovery Registry</h1>
    <div class="header-stats">
      <span><strong>${entries.length}</strong> user(s)</span>
      <span><strong>${entries.reduce((n, e) => n + (e.index?.resources.length ?? 0), 0)}</strong> total resources</span>
    </div>
  </header>
  ${entries.length > 0 ? userCards : '<div class="empty"><p>No users registered yet.</p></div>'}
</div>
</body></html>`);
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { router };
