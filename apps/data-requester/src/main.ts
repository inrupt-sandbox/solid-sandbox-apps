import { initAuth, isLoggedIn } from "./auth.js";
import { fetchPodIndex } from "./index-fetcher.js";
import { requestAccess } from "./access-requester.js";
import { renderAuthPanel } from "./ui/auth-panel.js";
import { renderSearchForm } from "./ui/search-panel.js";
import { renderResourceBrowser } from "./ui/resource-panel.js";
import { renderRequestForm } from "./ui/request-panel.js";
import { fetchReceivedGrants, fetchGrantedResource, listContainerContents } from "./grant-viewer.js";
import { renderGrantsPanel, renderResourceViewer } from "./ui/grants-panel.js";
import { renderChatPanel, appendMessage, setLoading, appendToolUse } from "./ui/chat-panel.js";
import { setResourceContext, setGrantContext, clearConversation, sendMessage } from "./chatbot.js";
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

  // Wire up tabs
  document.querySelectorAll<HTMLButtonElement>(".tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab!)!.classList.add("active");
    });
  });

  // Load granted access
  const grantsPanel = document.getElementById("grants-panel")!;
  const grantsList = document.getElementById("grants-list")!;
  const resourceViewer = document.getElementById("resource-viewer")!;
  const chatPanel = document.getElementById("chat-panel")!;
  const chatContainer = document.getElementById("chat-container")!;

  let grants: GrantInfo[] = [];

  async function loadGrantsAndChat(): Promise<void> {
    try {
      grants = await fetchReceivedGrants();
    } catch (err) {
      console.error("Failed to load grants:", err);
      return;
    }

    if (grants.length === 0) {
      chatPanel.classList.add("hidden");
      grantsPanel.classList.add("hidden");
      return;
    }

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

    // Set grant context for chatbot memory feature
    setGrantContext(
      grants.map((g) => ({
        grantId: g.id,
        resourceUrls: g.resourceUrls,
        modes: g.modes,
      }))
    );

    // Build list of all resources across all grants, expanding containers in parallel
    const availableResources: Array<{ url: string; grant: GrantInfo }> = [];
    const containerFetches: Promise<void>[] = [];

    for (const grant of grants) {
      const hasRead = grant.modes.some((m) => m.toLowerCase().includes("read"));
      for (const url of grant.resourceUrls) {
        if (url.endsWith("/")) {
          if (!hasRead) continue; // Write-only grant — can't list contents
          containerFetches.push(
            listContainerContents(url, grant.id)
              .then((contents) => {
                for (const childUrl of contents) {
                  if (!childUrl.endsWith("/")) {
                    availableResources.push({ url: childUrl, grant });
                  }
                }
              })
              .catch((err) => console.error(`Failed to list container ${url}:`, err))
          );
        } else {
          availableResources.push({ url, grant });
        }
      }
    }
    await Promise.all(containerFetches);

    // Check if any grant has Write mode
    const hasWriteGrant = grants.some((g) =>
      g.modes.some((m) => m.toLowerCase().includes("write"))
    );

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
            if (response.toolUses) {
              for (const tu of response.toolUses) {
                appendToolUse(chatContainer, tu);
              }
            }
            appendMessage(chatContainer, "assistant", response.content);
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
        },
        hasWriteGrant
      );
    } else {
      chatPanel.classList.add("hidden");
    }
  }

  // Load grants initially
  await loadGrantsAndChat();

  // Re-fetch grants when Chat tab is clicked (picks up newly accepted grants)
  document.querySelector('.tab[data-tab="chat-tab"]')!.addEventListener("click", () => {
    loadGrantsAndChat();
  });

  // Show tutor memory write-access request in the Request Access tab
  const memoryPanel = document.getElementById("memory-request-panel")!;
  const memoryContainer = document.getElementById("memory-request-container")!;
  memoryPanel.classList.remove("hidden");

  memoryContainer.innerHTML = `
    <p>Request write access to a user's pod so the AI Tutor can save study notes to <code>memory.ttl</code>.</p>
    <div class="search-row" style="margin-top: 0.75rem">
      <input type="text" id="memory-webid-input" class="input" placeholder="Enter pod owner's WebID" />
      <button id="memory-request-btn" class="btn btn-primary">Request write access</button>
    </div>
    <div id="memory-request-status" style="margin-top: 0.5rem; font-size: 0.85rem"></div>
  `;

  document.getElementById("memory-request-btn")!.addEventListener("click", async () => {
    const input = document.getElementById("memory-webid-input") as HTMLInputElement;
    const btn = document.getElementById("memory-request-btn") as HTMLButtonElement;
    const statusEl = document.getElementById("memory-request-status")!;
    const webId = input.value.trim();

    if (!webId) {
      statusEl.innerHTML = `<span class="error">Please enter a WebID</span>`;
      return;
    }

    btn.disabled = true;
    statusEl.textContent = "Resolving pod...";
    statusEl.className = "";

    try {
      const podRes = await fetch(`/api/pod-root?webId=${encodeURIComponent(webId)}`);
      if (!podRes.ok) {
        const err = await podRes.json().catch(() => ({ error: podRes.statusText }));
        throw new Error(err.error || "Failed to resolve pod");
      }
      const { podRoot } = await podRes.json();

      statusEl.textContent = "Sending access request...";
      await requestAccess([podRoot], webId, ["Write"], "AI Tutor memory — save study notes to memory.ttl");
      statusEl.innerHTML = `<span class="success">Write access request sent for ${podRoot}</span>`;
    } catch (err: any) {
      statusEl.innerHTML = `<span class="error">Failed: ${err.message}</span>`;
      btn.disabled = false;
    }
  });

  renderSearchForm(searchForm, searchResults, async (entry: DirectoryEntry) => {
    // Fill in the memory WebID input when a user is selected
    const memInput = document.getElementById("memory-webid-input") as HTMLInputElement | null;
    if (memInput) memInput.value = entry.webId;

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
