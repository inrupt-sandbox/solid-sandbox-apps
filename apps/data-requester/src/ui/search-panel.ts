import { DiscoveryClient, escapeHtml } from "@solid-ecosystem/shared";
import type { DirectoryEntry } from "@solid-ecosystem/shared";

const discovery = new DiscoveryClient();

export function renderSearchForm(
  formContainer: HTMLElement,
  resultsContainer: HTMLElement,
  onSelectUser: (entry: DirectoryEntry) => void
): void {
  formContainer.innerHTML = `
    <div class="search-row">
      <input type="text" id="webid-input" placeholder="Enter a WebID directly..." class="input" />
      <button id="lookup-btn" class="btn btn-secondary">Lookup</button>
    </div>
  `;

  document.getElementById("lookup-btn")!.addEventListener("click", () => {
    const webId = (document.getElementById("webid-input") as HTMLInputElement).value.trim();
    if (!webId) return;
    onSelectUser({ webId, registeredAt: "" });
  });

  document.getElementById("webid-input")!.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("lookup-btn")!.click();
  });

  // Auto-load directory
  loadDirectory(resultsContainer, onSelectUser);
}

async function loadDirectory(
  container: HTMLElement,
  onSelect: (entry: DirectoryEntry) => void
): Promise<void> {
  container.innerHTML = `<p class="muted">Loading users...</p>`;
  try {
    const entries = await discovery.getDirectory();
    renderResults(container, entries, onSelect);
  } catch {
    container.innerHTML = `<p class="error">Could not load directory. Is the discovery server running?</p>`;
  }
}

function renderResults(
  container: HTMLElement,
  entries: DirectoryEntry[],
  onSelect: (entry: DirectoryEntry) => void
): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="muted">No registered users yet.</p>`;
    return;
  }

  container.innerHTML = "";
  for (const entry of entries) {
    const card = document.createElement("div");
    card.className = "user-card";
    card.innerHTML = `
      <div class="user-info-card">
        <strong>${escapeHtml(entry.name ?? entry.webId)}</strong>
        <span class="muted">${escapeHtml(entry.webId)}</span>
        ${entry.index ? `<span class="badge">${entry.index.resources.length} resources</span>` : ""}
      </div>
    `;
    card.addEventListener("click", () => onSelect(entry));
    container.appendChild(card);
  }
}
