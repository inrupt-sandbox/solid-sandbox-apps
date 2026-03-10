import { initAuth, isLoggedIn } from "./auth.js";
import { fetchPodIndex } from "./index-fetcher.js";
import { requestAccess } from "./access-requester.js";
import { renderAuthPanel } from "./ui/auth-panel.js";
import { renderSearchForm } from "./ui/search-panel.js";
import { renderResourceBrowser } from "./ui/resource-panel.js";
import { renderRequestForm } from "./ui/request-panel.js";
import { fetchReceivedGrants, fetchGrantedResource } from "./grant-viewer.js";
import { renderGrantsPanel, renderResourceViewer } from "./ui/grants-panel.js";
import { renderChatPanel, appendMessage, setLoading } from "./ui/chat-panel.js";
import { setResourceContext, clearConversation, sendMessage } from "./chatbot.js";
import type { DirectoryEntry, PodIndex } from "@solid-ecosystem/shared";
import type { GrantInfo } from "./grant-viewer.js";

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

  // Load granted access
  const grantsPanel = document.getElementById("grants-panel")!;
  const grantsList = document.getElementById("grants-list")!;
  const resourceViewer = document.getElementById("resource-viewer")!;
  const chatPanel = document.getElementById("chat-panel")!;
  const chatContainer = document.getElementById("chat-container")!;

  try {
    const grants = await fetchReceivedGrants();
    if (grants.length > 0) {
      grantsPanel.classList.remove("hidden");
      renderGrantsPanel(grantsList, grants, async (resourceUrl, grant) => {
        resourceViewer.innerHTML = `<p class="muted">Loading resource...</p>`;
        resourceViewer.classList.remove("hidden");
        try {
          const rc = await fetchGrantedResource(resourceUrl, grant.id);
          renderResourceViewer(resourceViewer, resourceUrl, rc);
        } catch (err: any) {
          resourceViewer.innerHTML = `<p class="error">Failed to load resource: ${err.message}</p>`;
        }
      });

      // Build list of all non-container resources across all grants
      const availableResources: Array<{ url: string; grant: GrantInfo }> = [];
      for (const grant of grants) {
        for (const url of grant.resourceUrls) {
          if (!url.endsWith("/")) {
            availableResources.push({ url, grant });
          }
        }
      }

      if (availableResources.length > 0) {
        chatPanel.classList.remove("hidden");

        // Cache of fetched resource texts keyed by URL
        const resourceTextCache = new Map<string, { url: string; contentType: string; text: string }>();

        renderChatPanel(
          chatContainer,
          availableResources,
          async (userText) => {
            appendMessage(chatContainer, "user", userText);
            setLoading(chatContainer, true);
            try {
              const response = await sendMessage(userText);
              setLoading(chatContainer, false);
              appendMessage(chatContainer, "assistant", response);
            } catch (err: any) {
              setLoading(chatContainer, false);
              appendMessage(chatContainer, "assistant", `Error: ${err.message}`);
            }
          },
          async (selectedResources) => {
            // Fetch text content for newly selected resources
            const contextItems: Array<{ url: string; contentType: string; text: string }> = [];
            const statusEl = chatContainer.querySelector("#chat-context-status");

            for (const { url, grant } of selectedResources) {
              if (resourceTextCache.has(url)) {
                contextItems.push(resourceTextCache.get(url)!);
                continue;
              }

              if (statusEl) statusEl.textContent = `Loading ${getShortUrl(url)}...`;

              try {
                const rc = await fetchGrantedResource(url, grant.id);
                if (rc.text) {
                  const item = { url, contentType: rc.contentType, text: rc.text };
                  resourceTextCache.set(url, item);
                  contextItems.push(item);
                }
              } catch (err) {
                console.error(`Failed to load ${url} for chat:`, err);
              }
            }

            setResourceContext(contextItems);
            clearConversation();

            // Clear chat messages when context changes
            const messagesEl = chatContainer.querySelector("#chat-messages");
            if (messagesEl) messagesEl.innerHTML = "";

            if (statusEl) {
              const count = contextItems.length;
              statusEl.textContent = count > 0
                ? `${count} resource${count !== 1 ? "s" : ""} loaded into context`
                : "No resources selected";
            }
          }
        );
      }
    }
  } catch (err) {
    console.error("Failed to load grants:", err);
  }

  renderSearchForm(searchForm, searchResults, async (entry: DirectoryEntry) => {
    resourcePanel.classList.remove("hidden");
    resourceBrowser.innerHTML = `<p class="muted">Loading resources for ${entry.webId}...</p>`;

    try {
      const index = entry.index ?? (await fetchPodIndex(entry.webId));
      currentIndex = index;

      if (!index) {
        resourceBrowser.innerHTML = `<p class="muted">No public index found for this user.</p>`;
        return;
      }

      renderResourceBrowser(resourceBrowser, index, (selectedUrls) => {
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

function getShortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split("/").filter(Boolean).pop() || u.pathname;
  } catch {
    return url;
  }
}

main().catch(console.error);
