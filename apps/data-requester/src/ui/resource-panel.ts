import { escapeHtml } from "@solid-ecosystem/shared";
import type { PodIndex, PodResource } from "@solid-ecosystem/shared";

interface TreeNode {
  name: string;
  url: string;
  type: "container" | "resource";
  children: TreeNode[];
}

function buildTree(resources: PodResource[], podUrl: string): TreeNode[] {
  // Sort so containers come first, then alphabetically
  const sorted = [...resources].sort((a, b) => {
    if (a.type !== b.type) return a.type === "container" ? -1 : 1;
    return a.url.localeCompare(b.url);
  });

  // Build a map of container URL -> children
  const containerChildren = new Map<string, TreeNode[]>();
  const allNodes = new Map<string, TreeNode>();

  for (const res of sorted) {
    const shortPath = res.url.startsWith(podUrl)
      ? res.url.slice(podUrl.length) || "/"
      : new URL(res.url).pathname;

    const node: TreeNode = {
      name: shortPath,
      url: res.url,
      type: res.type,
      children: [],
    };
    allNodes.set(res.url, node);

    if (res.type === "container") {
      containerChildren.set(res.url, node.children);
    }
  }

  const roots: TreeNode[] = [];

  for (const res of sorted) {
    const node = allNodes.get(res.url)!;
    // Find the parent container
    const parentUrl = getParentContainer(res.url);
    if (parentUrl && containerChildren.has(parentUrl)) {
      // Shorten the name to just the last segment
      node.name = getLastSegment(res.url);
      containerChildren.get(parentUrl)!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function getParentContainer(url: string): string | null {
  // For a container like .../foo/, parent is .../
  // For a resource like .../foo, parent is .../
  const isContainer = url.endsWith("/");
  const trimmed = isContainer ? url.slice(0, -1) : url;
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash < 0) return null;
  return trimmed.slice(0, lastSlash + 1);
}

function getLastSegment(url: string): string {
  const isContainer = url.endsWith("/");
  const trimmed = isContainer ? url.slice(0, -1) : url;
  const name = trimmed.split("/").pop() || url;
  return isContainer ? name + "/" : name;
}

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
    <div class="resource-tree"></div>
    <div class="resource-actions">
      <button id="request-selected-btn" class="btn btn-primary" disabled>
        Request Access to Selected
      </button>
    </div>
  `;

  const treeEl = container.querySelector(".resource-tree")!;
  const selected = new Set<string>();
  const btn = document.getElementById("request-selected-btn") as HTMLButtonElement;
  const tree = buildTree(index.resources, index.podUrl);

  function updateBtn() {
    btn.disabled = selected.size === 0;
    btn.textContent = selected.size > 0
      ? `Request Access to Selected (${selected.size})`
      : "Request Access to Selected";
  }

  function renderNodes(parentEl: Element, nodes: TreeNode[], depth: number) {
    const ul = document.createElement("ul");
    ul.className = "resource-tree-list";
    if (depth > 0) ul.style.paddingLeft = "1.2rem";

    for (const node of nodes) {
      const li = document.createElement("li");
      li.className = "resource-tree-item";

      const row = document.createElement("label");
      row.className = "resource-tree-row";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = node.url;

      const label = document.createElement("span");
      const isContainer = node.type === "container";
      label.textContent = `${isContainer ? "\uD83D\uDCC1" : "\uD83D\uDCC4"} ${node.name}`;

      row.appendChild(cb);
      row.appendChild(label);
      li.appendChild(row);

      if (isContainer && node.children.length > 0) {
        renderNodes(li, node.children, depth + 1);
      }

      cb.addEventListener("change", () => {
        if (cb.checked) {
          selected.add(node.url);
          if (isContainer) {
            // Check all children too — they remain interactive
            li.querySelectorAll<HTMLInputElement>("ul input[type=checkbox]").forEach((child) => {
              child.checked = true;
              selected.add(child.value);
            });
          }
        } else {
          selected.delete(node.url);
          if (isContainer) {
            // Uncheck all children
            li.querySelectorAll<HTMLInputElement>("ul input[type=checkbox]").forEach((child) => {
              child.checked = false;
              selected.delete(child.value);
            });
          }
        }
        updateBtn();
      });

      ul.appendChild(li);
    }

    parentEl.appendChild(ul);
  }

  renderNodes(treeEl, tree, 0);

  btn.addEventListener("click", () => {
    onRequestAccess(Array.from(selected));
  });
}
