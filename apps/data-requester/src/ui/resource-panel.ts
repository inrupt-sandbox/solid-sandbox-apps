import { escapeHtml } from "@solid-ecosystem/shared";
import type { PodIndex, PodResource } from "@solid-ecosystem/shared";

export function renderResourceBrowser(
  container: HTMLElement,
  index: PodIndex,
  onRequestAccess: (resources: string[]) => void
): void {
  container.innerHTML = `
    <div class="resource-header">
      <p>Pod: <strong>${escapeHtml(index.podUrl)}</strong></p>
      <p class="muted">${index.resources.length} resources, updated ${index.updatedAt}</p>
    </div>
    <div class="resource-list"></div>
    <div class="resource-actions">
      <button id="request-selected-btn" class="btn btn-primary" disabled>
        Request Access to Selected
      </button>
    </div>
  `;

  const listEl = container.querySelector(".resource-list")!;
  const selected = new Set<string>();
  const btn = document.getElementById("request-selected-btn") as HTMLButtonElement;

  for (const res of index.resources) {
    const item = document.createElement("label");
    item.className = "resource-item";
    const icon = res.type === "container" ? "📁" : "📄";
    item.innerHTML = `
      <input type="checkbox" value="${escapeHtml(res.url)}" />
      <span>${icon} ${escapeHtml(getShortUrl(res.url, index.podUrl))}</span>
    `;

    const checkbox = item.querySelector("input")!;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selected.add(res.url);
      } else {
        selected.delete(res.url);
      }
      btn.disabled = selected.size === 0;
    });

    listEl.appendChild(item);
  }

  btn.addEventListener("click", () => {
    onRequestAccess(Array.from(selected));
  });
}

function getShortUrl(url: string, podUrl: string): string {
  if (url.startsWith(podUrl)) {
    return url.slice(podUrl.length) || "/";
  }
  return new URL(url).pathname;
}
