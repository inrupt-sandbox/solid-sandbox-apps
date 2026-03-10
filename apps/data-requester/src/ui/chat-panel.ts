import { marked } from "marked";
import { escapeHtml } from "@solid-ecosystem/shared";
import type { GrantInfo } from "../grant-viewer.js";

marked.setOptions({ breaks: true });

interface AvailableResource {
  url: string;
  grant: GrantInfo;
}

export function renderChatPanel(
  container: HTMLElement,
  availableResources: AvailableResource[],
  onSend: (text: string) => Promise<void>,
  onResourcesChanged: (selected: AvailableResource[]) => void
): void {
  const selectedUrls = new Set<string>();

  // Build resource picker
  const resourceItems = availableResources
    .map((r) => {
      const shortUrl = getShortUrl(r.url);
      return `<label class="chat-resource-item">
        <input type="checkbox" class="chat-resource-cb" data-url="${escapeHtml(r.url)}" />
        <span class="chat-resource-label" title="${escapeHtml(r.url)}">${escapeHtml(shortUrl)}</span>
        <span class="muted chat-resource-owner">from ${escapeHtml(getShortWebId(r.grant.ownerWebId))}</span>
      </label>`;
    })
    .join("");

  container.innerHTML = `
    <div class="chat-resource-picker">
      <p class="chat-picker-label">Select resources to include in chat:</p>
      <div class="chat-resource-list">${resourceItems}</div>
      <p class="chat-context-status muted" id="chat-context-status">No resources selected</p>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-input-row">
      <input type="text" class="input chat-input" id="chat-input" placeholder="Ask about your resources..." disabled />
      <button class="btn btn-primary chat-send-btn" id="chat-send-btn" disabled>Send</button>
    </div>
  `;

  const input = container.querySelector("#chat-input") as HTMLInputElement;
  const sendBtn = container.querySelector("#chat-send-btn") as HTMLButtonElement;
  const statusEl = container.querySelector("#chat-context-status")!;

  function updateStatus() {
    const count = selectedUrls.size;
    if (count === 0) {
      statusEl.textContent = "No resources selected";
      input.disabled = true;
      sendBtn.disabled = true;
    } else {
      statusEl.textContent = `${count} resource${count !== 1 ? "s" : ""} loaded into context`;
      input.disabled = false;
      sendBtn.disabled = false;
    }
  }

  // Wire up checkboxes
  container.querySelectorAll<HTMLInputElement>(".chat-resource-cb").forEach((cb) => {
    cb.addEventListener("change", () => {
      const url = cb.dataset.url!;
      if (cb.checked) {
        selectedUrls.add(url);
      } else {
        selectedUrls.delete(url);
      }
      updateStatus();
      const selected = availableResources.filter((r) => selectedUrls.has(r.url));
      onResourcesChanged(selected);
    });
  });

  // Wire up send
  async function handleSend() {
    const text = input.value.trim();
    if (!text || selectedUrls.size === 0) return;

    input.value = "";
    sendBtn.disabled = true;
    input.disabled = true;

    try {
      await onSend(text);
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
}

export function appendMessage(
  container: HTMLElement,
  role: "user" | "assistant",
  content: string
): void {
  const messagesEl = container.querySelector("#chat-messages");
  if (!messagesEl) return;

  const msg = document.createElement("div");
  msg.className = `chat-message chat-message-${role}`;
  if (role === "assistant") {
    msg.innerHTML = marked.parse(content) as string;
  } else {
    msg.textContent = content;
  }
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

export function setLoading(container: HTMLElement, loading: boolean): void {
  const messagesEl = container.querySelector("#chat-messages");
  if (!messagesEl) return;

  const existing = messagesEl.querySelector(".chat-loading");
  if (loading && !existing) {
    const loader = document.createElement("div");
    loader.className = "chat-loading";
    loader.textContent = "Thinking...";
    messagesEl.appendChild(loader);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else if (!loading && existing) {
    existing.remove();
  }
}

function getShortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split("/").filter(Boolean).slice(-2).join("/") || u.pathname;
  } catch {
    return url;
  }
}

function getShortWebId(webId: string): string {
  try {
    const u = new URL(webId);
    return u.pathname.replace(/^\//, "") || u.hostname;
  } catch {
    return webId;
  }
}
