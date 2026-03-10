import type { PodResource } from "@solid-ecosystem/shared";

export interface TreeCallbacks {
  onSelectResource?: (url: string) => void;
  onSelectContainer?: (url: string) => void;
}

export function renderTreeView(
  container: HTMLElement,
  resources: PodResource[],
  callbacks?: TreeCallbacks
): void {
  const tree = buildTree(resources);
  container.innerHTML = "";
  const ul = renderSubtree([tree], 0, callbacks);
  container.appendChild(ul);
}

interface TreeNode {
  name: string;
  url: string;
  type: "container" | "resource";
  children: TreeNode[];
}

function buildTree(resources: PodResource[]): TreeNode {
  const containers = resources.filter((r) => r.type === "container");
  const files = resources.filter((r) => r.type === "resource");

  // Find root
  const root = containers.reduce((shortest, c) =>
    c.url.length < shortest.url.length ? c : shortest
  );

  const rootNode: TreeNode = {
    name: new URL(root.url).pathname,
    url: root.url,
    type: "container",
    children: [],
  };

  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set(root.url, rootNode);

  // Add containers
  const sortedContainers = containers
    .filter((c) => c.url !== root.url)
    .sort((a, b) => a.url.length - b.url.length);

  for (const c of sortedContainers) {
    const node: TreeNode = {
      name: getLastSegment(c.url),
      url: c.url,
      type: "container",
      children: [],
    };
    nodeMap.set(c.url, node);

    const parentUrl = getParentUrl(c.url);
    const parent = nodeMap.get(parentUrl);
    if (parent) {
      parent.children.push(node);
    } else {
      rootNode.children.push(node);
    }
  }

  // Add files
  for (const f of files) {
    const node: TreeNode = {
      name: getLastSegment(f.url),
      url: f.url,
      type: "resource",
      children: [],
    };
    const parentUrl = getParentUrl(f.url);
    const parent = nodeMap.get(parentUrl);
    if (parent) {
      parent.children.push(node);
    } else {
      rootNode.children.push(node);
    }
  }

  return rootNode;
}

function clearSelection(): void {
  document.querySelectorAll(".tree-item.selected").forEach((el) => el.classList.remove("selected"));
}

function renderSubtree(
  nodes: TreeNode[],
  depth: number,
  callbacks?: TreeCallbacks
): HTMLUListElement {
  const ul = document.createElement("ul");
  ul.className = "tree";

  const sorted = nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "container" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const node of sorted) {
    const li = document.createElement("li");
    // Only root (depth 0) is expanded; everything else starts collapsed
    if (depth > 0 && node.children.length > 0) {
      li.classList.add("collapsed");
    }

    const icon = node.type === "container" ? "📁" : "📄";
    const span = document.createElement("span");
    span.className = `tree-item tree-${node.type}`;
    span.textContent = `${icon} ${node.name}`;
    span.title = node.url;
    span.dataset.url = node.url;
    span.dataset.type = node.type;
    li.appendChild(span);

    if (node.type === "container") {
      span.classList.add("tree-selectable");
      span.addEventListener("click", () => {
        li.classList.toggle("collapsed");
        clearSelection();
        span.classList.add("selected");
        callbacks?.onSelectContainer?.(node.url);
      });
      if (node.children.length > 0) {
        li.appendChild(renderSubtree(node.children, depth + 1, callbacks));
      }
    } else {
      span.classList.add("tree-selectable");
      span.addEventListener("click", () => {
        clearSelection();
        span.classList.add("selected");
        callbacks?.onSelectResource?.(node.url);
      });
    }

    ul.appendChild(li);
  }

  return ul;
}

function getLastSegment(url: string): string {
  const path = new URL(url).pathname;
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] + (url.endsWith("/") ? "/" : "");
}

function getParentUrl(url: string): string {
  const u = new URL(url);
  const path = u.pathname.endsWith("/")
    ? u.pathname.slice(0, -1)
    : u.pathname;
  const parentPath = path.substring(0, path.lastIndexOf("/") + 1);
  return `${u.origin}${parentPath}`;
}
