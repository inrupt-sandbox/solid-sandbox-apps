import type { GrantInfo, ResourceContent } from "../grant-viewer.js";
import { listContainerContents } from "../grant-viewer.js";
import { escapeHtml } from "@solid-ecosystem/shared";

export function renderGrantsPanel(
  container: HTMLElement,
  grants: GrantInfo[],
  onViewResource: (resourceUrl: string, grant: GrantInfo) => void
): void {
  if (grants.length === 0) {
    container.innerHTML = `<p class="muted">No granted access yet.</p>`;
    return;
  }

  container.innerHTML = "";

  for (const grant of grants) {
    const card = document.createElement("div");
    card.className = "grant-card";

    const expiry = grant.expiresAt
      ? new Date(grant.expiresAt).toLocaleDateString()
      : "No expiration";

    card.innerHTML = `
      <div class="grant-info">
        <strong>From: ${escapeHtml(grant.ownerWebId)}</strong>
        <p class="grant-meta">
          <span class="mode-badges">${grant.modes.map((m) => `<span class="mode-badge">${m}</span>`).join(" ")}</span>
          <span class="grant-expiry">Expires: ${expiry}</span>
        </p>
        <ul class="grant-resources"></ul>
      </div>
    `;

    const listEl = card.querySelector(".grant-resources")!;
    renderResourceList(listEl, grant.resourceUrls, grant, onViewResource);

    container.appendChild(card);
  }
}

function renderResourceList(
  listEl: Element,
  urls: string[],
  grant: GrantInfo,
  onViewResource: (resourceUrl: string, grant: GrantInfo) => void
): void {
  for (const u of urls) {
    const li = document.createElement("li");
    const isContainer = u.endsWith("/");

    if (isContainer) {
      li.innerHTML = `
        <span class="resource-url">${escapeHtml(u)}</span>
        <button class="btn btn-small browse-btn">Browse</button>
        <ul class="container-contents hidden"></ul>
      `;

      const browseBtn = li.querySelector(".browse-btn")!;
      const contentsEl = li.querySelector(".container-contents")!;
      let loaded = false;

      browseBtn.addEventListener("click", async () => {
        if (loaded) {
          contentsEl.classList.toggle("hidden");
          browseBtn.textContent = contentsEl.classList.contains("hidden") ? "Browse" : "Collapse";
          return;
        }

        browseBtn.textContent = "Loading...";
        (browseBtn as HTMLButtonElement).disabled = true;

        try {
          const contents = await listContainerContents(u, grant.id);
          loaded = true;
          contentsEl.classList.remove("hidden");
          browseBtn.textContent = "Collapse";
          (browseBtn as HTMLButtonElement).disabled = false;

          if (contents.length === 0) {
            contentsEl.innerHTML = `<li class="muted">Empty container</li>`;
          } else {
            renderResourceList(contentsEl, contents, grant, onViewResource);
          }
        } catch (err: any) {
          browseBtn.textContent = "Browse";
          (browseBtn as HTMLButtonElement).disabled = false;
          contentsEl.innerHTML = `<li class="error">Failed: ${err.message}</li>`;
          contentsEl.classList.remove("hidden");
        }
      });
    } else {
      li.innerHTML = `
        <span class="resource-url">${escapeHtml(u)}</span>
        <button class="btn btn-small view-btn">View</button>
      `;

      li.querySelector(".view-btn")!.addEventListener("click", () => {
        onViewResource(u, grant);
      });
    }

    listEl.appendChild(li);
  }
}

export function renderResourceViewer(
  container: HTMLElement,
  resourceUrl: string,
  content: ResourceContent
): void {
  container.classList.remove("hidden");

  if (content.text !== null) {
    container.innerHTML = `
      <div class="resource-viewer-header">
        <strong>${escapeHtml(resourceUrl)}</strong>
        <span class="muted">(${escapeHtml(content.contentType)})</span>
        <button class="btn btn-small close-viewer-btn">Close</button>
      </div>
      <pre class="resource-viewer-content"><code>${escapeHtml(content.text)}</code></pre>
    `;
  } else {
    const filename = resourceUrl.split("/").pop() || "download";
    container.innerHTML = `
      <div class="resource-viewer-header">
        <strong>${escapeHtml(resourceUrl)}</strong>
        <span class="muted">(${escapeHtml(content.contentType)})</span>
        <button class="btn btn-small close-viewer-btn">Close</button>
      </div>
      <p><a href="${content.blobUrl}" download="${escapeHtml(filename)}" class="btn btn-primary">Download File</a></p>
    `;
  }

  container.querySelector(".close-viewer-btn")!.addEventListener("click", () => {
    container.classList.add("hidden");
    container.innerHTML = "";
  });
}
