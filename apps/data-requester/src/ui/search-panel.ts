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
      <input type="text" id="search-input" placeholder="Search by WebID or name..." class="input" />
      <button id="search-btn" class="btn btn-primary">Search</button>
      <button id="browse-btn" class="btn btn-secondary">Browse All</button>
    </div>
    <div class="search-row" style="margin-top: 0.5rem">
      <input type="text" id="webid-input" placeholder="Or enter a WebID directly..." class="input" />
      <button id="lookup-btn" class="btn btn-secondary">Lookup</button>
    </div>
  `;

  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  const webIdInput = document.getElementById("webid-input") as HTMLInputElement;

  document.getElementById("search-btn")!.addEventListener("click", async () => {
    const q = searchInput.value.trim();
    if (!q) return;
    try {
      const results = await discovery.search(q);
      renderResults(resultsContainer, results, onSelectUser);
    } catch (err) {
      resultsContainer.innerHTML = `<p class="error">Search failed. Is the discovery server running?</p>`;
    }
  });

  document.getElementById("browse-btn")!.addEventListener("click", async () => {
    try {
      const results = await discovery.getDirectory();
      renderResults(resultsContainer, results, onSelectUser);
    } catch (err) {
      resultsContainer.innerHTML = `<p class="error">Could not load directory. Is the discovery server running?</p>`;
    }
  });

  document.getElementById("lookup-btn")!.addEventListener("click", () => {
    const webId = webIdInput.value.trim();
    if (!webId) return;
    onSelectUser({
      webId,
      registeredAt: "",
    });
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("search-btn")!.click();
  });
}

function renderResults(
  container: HTMLElement,
  entries: DirectoryEntry[],
  onSelect: (entry: DirectoryEntry) => void
): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="muted">No users found.</p>`;
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
