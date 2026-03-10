import type { PodResource } from "@solid-ecosystem/shared";

export function renderTreeView(
  container: HTMLElement,
  resources: PodResource[]
): void {
  const tree = buildTree(resources);
  container.innerHTML = "";
  const ul = renderNode(tree);
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

function renderNode(node: TreeNode): HTMLUListElement {
  const ul = document.createElement("ul");
  ul.className = "tree";

  const li = document.createElement("li");
  const icon = node.type === "container" ? "📁" : "📄";
  const span = document.createElement("span");
  span.className = `tree-item tree-${node.type}`;
  span.textContent = `${icon} ${node.name}`;
  span.title = node.url;

  if (node.type === "container" && node.children.length > 0) {
    span.addEventListener("click", () => {
      li.classList.toggle("collapsed");
    });
  }

  li.appendChild(span);

  if (node.children.length > 0) {
    const childUl = document.createElement("ul");
    for (const child of node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "container" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })) {
      const childLi = document.createElement("li");
      const childIcon = child.type === "container" ? "📁" : "📄";
      const childSpan = document.createElement("span");
      childSpan.className = `tree-item tree-${child.type}`;
      childSpan.textContent = `${childIcon} ${child.name}`;
      childSpan.title = child.url;

      childLi.appendChild(childSpan);

      if (child.children.length > 0) {
        childSpan.addEventListener("click", () => {
          childLi.classList.toggle("collapsed");
        });
        const grandchildUl = renderNode(child);
        childLi.appendChild(grandchildUl.firstElementChild!.querySelector("ul") ?? renderSubtree(child.children));
      }

      childUl.appendChild(childLi);
    }
    li.appendChild(childUl);
  }

  ul.appendChild(li);
  return ul;
}

function renderSubtree(children: TreeNode[]): HTMLUListElement {
  const ul = document.createElement("ul");
  for (const child of children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "container" ? -1 : 1;
    return a.name.localeCompare(b.name);
  })) {
    const li = document.createElement("li");
    const icon = child.type === "container" ? "📁" : "📄";
    const span = document.createElement("span");
    span.className = `tree-item tree-${child.type}`;
    span.textContent = `${icon} ${child.name}`;
    span.title = child.url;
    li.appendChild(span);

    if (child.children.length > 0) {
      span.addEventListener("click", () => li.classList.toggle("collapsed"));
      li.appendChild(renderSubtree(child.children));
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
