import { initAuth, isLoggedIn, getWebId, getAuthFetch } from "./auth.js";
import { spiderPod, getPodUrl } from "./pod-spider.js";
import { buildIndex } from "./index-builder.js";
import { writeIndexToPod } from "./index-writer.js";
import {
  fetchAccessRequests,
  approveRequest,
  denyRequest,
  fetchActiveGrants,
  revokeGrant,
} from "./access-grants.js";
import { renderAuthPanel } from "./ui/auth-panel.js";
import { renderTreeView } from "./ui/tree-view.js";
import type { TreeCallbacks } from "./ui/tree-view.js";
import {
  renderStatusBar,
  renderStatusDone,
  renderStatusError,
} from "./ui/status-bar.js";
import { renderAccessPanel } from "./ui/access-panel.js";
import { renderGrantsPanel } from "./ui/grants-panel.js";
import { initUploadPanel, setUploadTarget } from "./ui/upload-panel.js";
import { loadResource, loadContainerView } from "./ui/data-viewer.js";
import { DiscoveryClient } from "@solid-ecosystem/shared";
import type { DirectoryEntry, PodResource } from "@solid-ecosystem/shared";

const discovery = new DiscoveryClient();

let currentResources: PodResource[] = [];
let currentPodUrl: string | undefined;

function initTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const pane = document.getElementById(`tab-${tab.dataset.tab}`);
      pane?.classList.add("active");
    });
  });
}

async function main(): Promise<void> {
  await initAuth();

  const authSection = document.getElementById("auth-section")!;
  const statusBar = document.getElementById("status-bar")!;
  const content = document.getElementById("content")!;
  const podTree = document.getElementById("pod-tree")!;
  const podActions = document.getElementById("pod-actions")!;
  const accessRequests = document.getElementById("access-requests")!;
  const activeGrantsEl = document.getElementById("active-grants")!;
  const uploadArea = document.getElementById("upload-area")!;
  const viewerTitle = document.getElementById("viewer-title")!;
  const viewerContent = document.getElementById("viewer-content")!;

  renderAuthPanel(authSection);

  if (!isLoggedIn()) return;

  content.classList.remove("hidden");
  initTabs();

  const webId = getWebId()!;
  const authFetch = getAuthFetch();

  function getContainerUrls(): string[] {
    return currentResources
      .filter((r) => r.type === "container")
      .map((r) => r.url)
      .sort((a, b) => a.length - b.length);
  }

  const treeCallbacks: TreeCallbacks = {
    onSelectResource(url: string) {
      loadResource({
        url,
        authFetch,
        titleEl: viewerTitle,
        contentEl: viewerContent,
        containerUrls: getContainerUrls(),
        onMoved: () => refreshPod(),
        onDeleted: () => refreshPod(),
      });
    },
    onSelectContainer(url: string) {
      setUploadTarget(url);
      const childCount = currentResources.filter(
        (r) => r.url !== url && r.url.startsWith(url)
      ).length;
      loadContainerView({
        url,
        authFetch,
        titleEl: viewerTitle,
        contentEl: viewerContent,
        childCount,
        onDeleted: () => refreshPod(),
      });
    },
  };

  function renderTree(resources: PodResource[]): void {
    renderTreeView(podTree, resources, treeCallbacks);
  }

  // Init upload panel (starts empty until a container is selected)
  initUploadPanel(uploadArea, authFetch, () => refreshPod());

  async function refreshPod(): Promise<void> {
    try {
      const resources = await spiderPod(
        webId,
        authFetch,
        () => {},
        (partial) => {
          currentResources = partial;
          currentPodUrl = getPodUrl(partial);
          renderTree(partial);
        }
      );
      currentResources = resources;
      currentPodUrl = getPodUrl(resources);
      renderTree(resources);
    } catch (err) {
      console.error("Re-spider failed:", err);
    }
  }

  // Load access requests and grants immediately (don't wait for spider)
  async function loadAccessRequests(): Promise<void> {
    try {
      const requests = await fetchAccessRequests(authFetch);
      renderAccessPanel(
        accessRequests,
        requests,
        async (id) => {
          const req = requests.find((r) => r.id === id);
          if (!req) return;
          try {
            await approveRequest(req.vc, authFetch);
            await loadAccessRequests();
          } catch (err) {
            console.error("Approve failed:", err);
          }
        },
        async (id) => {
          const req = requests.find((r) => r.id === id);
          if (!req) return;
          try {
            await denyRequest(req.vc, authFetch);
            await loadAccessRequests();
          } catch (err) {
            console.error("Deny failed:", err);
          }
        }
      );
    } catch (err) {
      accessRequests.innerHTML = `<p class="muted">Could not load access requests.</p>`;
    }
  }

  async function loadActiveGrants(): Promise<void> {
    try {
      const grants = await fetchActiveGrants(authFetch);
      renderGrantsPanel(activeGrantsEl, grants, async (id) => {
        const grant = grants.find((g) => g.id === id);
        if (!grant) return;
        try {
          await revokeGrant(grant.vc, authFetch);
          await loadActiveGrants();
        } catch (err) {
          console.error("Revoke failed:", err);
        }
      });
    } catch (err) {
      activeGrantsEl.innerHTML = `<p class="muted">Could not load active grants.</p>`;
    }
  }

  // Start grants/requests, registry check, and spider all in parallel
  const grantsPromise = Promise.all([loadAccessRequests(), loadActiveGrants()]);
  const registryCheck: Promise<DirectoryEntry | null> = discovery.lookup(webId).catch(() => null);

  statusBar.classList.remove("hidden");
  statusBar.innerHTML = `<div class="status-content"><span class="spinner"></span> Starting pod scan...</div>`;

  try {
    const resources = await spiderPod(
      webId,
      authFetch,
      (progress) => renderStatusBar(statusBar, progress),
      (partial) => {
        currentResources = partial;
        currentPodUrl = getPodUrl(partial);
        renderTree(partial);
      }
    );

    currentResources = resources;
    currentPodUrl = getPodUrl(resources);

    renderStatusDone(statusBar, resources.length);

    // Wait for registry check to finish before rendering buttons
    const registryEntry = await registryCheck;

    const registryResourceCount = registryEntry?.index?.resources.length ?? 0;
    const isRegistered = registryEntry !== null;
    const isIndexUpToDate = isRegistered && registryResourceCount === resources.length;

    renderActionButtons(podActions, webId, authFetch, isRegistered, isIndexUpToDate);
  } catch (err: any) {
    renderStatusError(statusBar, err.message);
  }

  // Ensure grants/requests finish even if spider fails
  await grantsPromise;
}

function renderActionButtons(
  container: HTMLElement,
  webId: string,
  authFetch: typeof fetch,
  isRegistered: boolean,
  isIndexUpToDate: boolean
): void {
  const publishBtn = document.createElement("button");
  publishBtn.id = "publish-btn";
  publishBtn.className = "btn btn-primary btn-sm";
  publishBtn.textContent = "Publish Index";

  container.innerHTML = "";
  container.appendChild(publishBtn);

  if (!isRegistered) {
    const registerBtn = document.createElement("button");
    registerBtn.id = "register-btn";
    registerBtn.className = "btn btn-secondary btn-sm";
    registerBtn.textContent = "Register with Discovery";
    container.appendChild(registerBtn);

    registerBtn.addEventListener("click", async () => {
      registerBtn.disabled = true;
      registerBtn.textContent = "Registering...";
      try {
        await discovery.register(webId, undefined, currentPodUrl);
        registerBtn.textContent = "Registered!";
        registerBtn.classList.add("btn-success");
      } catch (err: any) {
        registerBtn.textContent = "Register Failed";
        registerBtn.classList.add("btn-danger");
        console.error("Registration failed:", err);
      }
    });
  } else if (!isIndexUpToDate) {
    const updateBtn = document.createElement("button");
    updateBtn.id = "update-registry-btn";
    updateBtn.className = "btn btn-secondary btn-sm";
    updateBtn.textContent = "Update Registry";
    container.appendChild(updateBtn);

    updateBtn.addEventListener("click", async () => {
      updateBtn.disabled = true;
      updateBtn.textContent = "Updating...";
      try {
        await discovery.refreshIndex(webId, currentPodUrl);
        updateBtn.textContent = "Registry Updated!";
        updateBtn.classList.add("btn-success");
      } catch (err: any) {
        updateBtn.textContent = "Update Failed";
        updateBtn.classList.add("btn-danger");
        console.error("Registry update failed:", err);
      }
    });
  } else {
    const statusSpan = document.createElement("span");
    statusSpan.className = "registry-status";
    statusSpan.textContent = "Registry up to date";
    container.appendChild(statusSpan);
  }

  publishBtn.addEventListener("click", async () => {
    if (!currentPodUrl) return;
    publishBtn.disabled = true;
    publishBtn.textContent = "Publishing...";
    try {
      const { dataset, indexUrl } = buildIndex(webId, currentPodUrl, currentResources);
      await writeIndexToPod(indexUrl, dataset, authFetch);
      publishBtn.textContent = "Published!";
      publishBtn.classList.add("btn-success");
      console.log("Index published at:", indexUrl);
    } catch (err: any) {
      publishBtn.textContent = "Publish Failed";
      publishBtn.classList.add("btn-danger");
      console.error("Publish failed:", err);
    }
  });
}

main().catch(console.error);
