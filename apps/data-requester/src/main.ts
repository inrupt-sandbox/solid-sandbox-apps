import { initAuth, isLoggedIn, getWebId, getAuthFetch } from "./auth.js";
import { fetchPodIndex } from "./index-fetcher.js";
import { requestAccess } from "./access-requester.js";
import { renderAuthPanel } from "./ui/auth-panel.js";
import { renderSearchForm } from "./ui/search-panel.js";
import { renderResourceBrowser } from "./ui/resource-panel.js";
import { renderRequestForm } from "./ui/request-panel.js";
import { fetchReceivedGrants, fetchGrantedResource } from "./grant-viewer.js";
import { renderGrantsPanel, renderResourceViewer } from "./ui/grants-panel.js";
import type { DirectoryEntry, PodIndex } from "@solid-ecosystem/shared";

let currentIndex: PodIndex | null = null;

async function main(): Promise<void> {
  await initAuth();

  const authSection = document.getElementById("auth-section")!;
  const content = document.getElementById("content")!;
  const searchForm = document.getElementById("search-form")!;
  const searchResults = document.getElementById("search-results")!;
  const resourcePanel = document.getElementById("resource-panel")!;
  const resourceBrowser = document.getElementById("resource-browser")!;
  const requestPanel = document.getElementById("request-panel")!;
  const requestForm = document.getElementById("request-form")!;

  renderAuthPanel(authSection);

  if (!isLoggedIn()) return;

  content.classList.remove("hidden");
  const authFetch = getAuthFetch();

  // Load granted access
  const grantsPanel = document.getElementById("grants-panel")!;
  const grantsList = document.getElementById("grants-list")!;
  const resourceViewer = document.getElementById("resource-viewer")!;

  try {
    const grants = await fetchReceivedGrants(authFetch);
    if (grants.length > 0) {
      grantsPanel.classList.remove("hidden");
      renderGrantsPanel(grantsList, grants, async (resourceUrl, grant) => {
        resourceViewer.innerHTML = `<p class="muted">Loading resource...</p>`;
        resourceViewer.classList.remove("hidden");
        try {
          const content = await fetchGrantedResource(resourceUrl, grant.vc, authFetch);
          renderResourceViewer(resourceViewer, resourceUrl, content);
        } catch (err: any) {
          resourceViewer.innerHTML = `<p class="error">Failed to load resource: ${err.message}</p>`;
        }
      });
    }
  } catch (err) {
    console.error("Failed to load grants:", err);
  }

  renderSearchForm(searchForm, searchResults, async (entry: DirectoryEntry) => {
    // User selected - fetch their index
    resourcePanel.classList.remove("hidden");
    resourceBrowser.innerHTML = `<p class="muted">Loading resources for ${entry.webId}...</p>`;

    try {
      // Use cached index from discovery if available, otherwise fetch
      const index = entry.index ?? (await fetchPodIndex(entry.webId, authFetch));
      currentIndex = index;

      if (!index) {
        resourceBrowser.innerHTML = `<p class="muted">No public index found for this user.</p>`;
        return;
      }

      renderResourceBrowser(resourceBrowser, index, (selectedUrls) => {
        // Show request form
        requestPanel.classList.remove("hidden");
        renderRequestForm(
          requestForm,
          selectedUrls,
          index.webId,
          async (modes, purpose) => {
            const statusEl = document.getElementById("request-status")!;
            const btn = document.getElementById(
              "submit-request-btn"
            ) as HTMLButtonElement;
            btn.disabled = true;
            statusEl.innerHTML = `<p>Sending request...</p>`;

            try {
              await requestAccess(
                selectedUrls,
                index.webId,
                modes,
                authFetch,
                purpose || undefined
              );
              statusEl.innerHTML = `<p class="success">Access request sent successfully!</p>`;
            } catch (err: any) {
              statusEl.innerHTML = `<p class="error">Failed: ${err.message}</p>`;
              btn.disabled = false;
            }
          }
        );
      });
    } catch (err: any) {
      resourceBrowser.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
  });
}

main().catch(console.error);
