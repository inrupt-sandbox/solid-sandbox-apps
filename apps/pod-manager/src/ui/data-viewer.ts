import { getFile } from "@inrupt/solid-client";
import { escapeHtml } from "@solid-ecosystem/shared";
import { moveResource } from "../uploader.js";

const TEXT_TYPES = [
  "text/",
  "application/json",
  "application/ld+json",
  "application/xml",
  "application/xhtml+xml",
  "application/javascript",
  "application/typescript",
  "application/x-turtle",
  "application/rdf+xml",
  "application/n-triples",
  "application/n-quads",
  "application/trig",
];

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp"];

function isTextType(ct: string): boolean {
  return TEXT_TYPES.some((t) => ct.startsWith(t));
}

function isImageType(ct: string): boolean {
  return IMAGE_TYPES.some((t) => ct.startsWith(t));
}

function guessContentType(url: string): string | null {
  const ext = url.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ttl: "text/turtle",
    jsonld: "application/ld+json",
    json: "application/json",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    xml: "application/xml",
    rdf: "application/rdf+xml",
    nt: "application/n-triples",
    nq: "application/n-quads",
    csv: "text/csv",
    md: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    pdf: "application/pdf",
  };
  return ext ? map[ext] ?? null : null;
}

export interface ViewerOptions {
  url: string;
  authFetch: typeof fetch;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  containerUrls: string[];
  onMoved: () => void;
}

export async function loadResource(opts: ViewerOptions): Promise<void> {
  const { url, authFetch, titleEl, contentEl, containerUrls, onMoved } = opts;
  const name = decodeURIComponent(url.split("/").filter(Boolean).pop() ?? url);
  titleEl.textContent = name;
  contentEl.innerHTML = `<div class="viewer-loading"><span class="spinner"></span> Loading...</div>`;

  try {
    const file = await getFile(url, { fetch: authFetch });
    const ct = file.type || guessContentType(url) || "application/octet-stream";
    const size = file.size;

    // Build toolbar
    const toolbar = buildToolbar(url, ct, size, containerUrls, authFetch, contentEl, onMoved);

    // Build content
    let bodyHtml = "";

    if (isImageType(ct)) {
      const objectUrl = URL.createObjectURL(file);
      bodyHtml = `<div class="viewer-image"><img src="${objectUrl}" alt="${escapeHtml(name)}" /></div>`;
    } else if (isTextType(ct) || guessContentType(url)?.startsWith("text/")) {
      if (size > 500_000) {
        bodyHtml = `<p class="muted">File too large to display inline (${formatSize(size)})</p>`;
      } else {
        const text = await file.text();
        bodyHtml = `<pre class="viewer-text"><code>${escapeHtml(text)}</code></pre>`;
      }
    } else {
      bodyHtml = `<p class="muted">Binary file — cannot display inline</p>`;
    }

    contentEl.innerHTML = "";
    contentEl.appendChild(toolbar);
    contentEl.insertAdjacentHTML("beforeend", bodyHtml);
  } catch (err: any) {
    const status = err?.statusCode ?? err?.response?.status;
    if (status === 403 || status === 401) {
      contentEl.innerHTML = `<p class="viewer-error">Access denied (${status})</p>`;
    } else {
      contentEl.innerHTML = `<p class="viewer-error">Failed to load: ${escapeHtml(err.message)}</p>`;
    }
  }
}

function buildToolbar(
  url: string,
  ct: string,
  size: number,
  containerUrls: string[],
  authFetch: typeof fetch,
  contentEl: HTMLElement,
  onMoved: () => void
): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "viewer-toolbar";

  // Meta info
  const meta = document.createElement("div");
  meta.className = "viewer-meta";
  meta.innerHTML = `
    <span>${escapeHtml(ct)}</span>
    <span>${formatSize(size)}</span>
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="viewer-link">Open raw</a>
  `;
  toolbar.appendChild(meta);

  // Actions row
  const actions = document.createElement("div");
  actions.className = "viewer-actions";

  // Move button + container picker
  const moveBtn = document.createElement("button");
  moveBtn.className = "btn btn-secondary btn-sm";
  moveBtn.textContent = "Move to...";
  actions.appendChild(moveBtn);

  const movePanel = document.createElement("div");
  movePanel.className = "move-panel hidden";

  const select = document.createElement("select");
  select.className = "move-select";
  // Filter out the container the file is already in
  const currentContainer = url.substring(0, url.lastIndexOf("/") + 1);
  for (const cUrl of containerUrls) {
    if (cUrl === currentContainer) continue;
    const opt = document.createElement("option");
    opt.value = cUrl;
    opt.textContent = new URL(cUrl).pathname;
    select.appendChild(opt);
  }
  movePanel.appendChild(select);

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "btn btn-primary btn-sm";
  confirmBtn.textContent = "Move";
  movePanel.appendChild(confirmBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-secondary btn-sm";
  cancelBtn.textContent = "Cancel";
  movePanel.appendChild(cancelBtn);

  actions.appendChild(movePanel);
  toolbar.appendChild(actions);

  moveBtn.addEventListener("click", () => {
    movePanel.classList.toggle("hidden");
  });

  cancelBtn.addEventListener("click", () => {
    movePanel.classList.add("hidden");
  });

  confirmBtn.addEventListener("click", async () => {
    const dest = select.value;
    if (!dest) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Moving...";
    try {
      await moveResource(url, dest, authFetch);
      contentEl.innerHTML = `<p class="viewer-success">Moved to ${escapeHtml(new URL(dest).pathname)}</p>`;
      onMoved();
    } catch (err: any) {
      confirmBtn.textContent = "Failed";
      confirmBtn.classList.add("btn-danger");
      console.error("Move failed:", err);
    }
  });

  return toolbar;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
