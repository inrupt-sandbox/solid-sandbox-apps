interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ResourceContext {
  url: string;
  contentType: string;
  text: string;
}

export interface GrantContext {
  grantId: string;
  resourceUrls: string[];
  modes: string[];
}

export interface ToolUse {
  tool: string;
  title: string;
}

export interface ChatResponse {
  content: string;
  toolUses?: ToolUse[];
}

let messages: ChatMessage[] = [];
let resourceContext: ResourceContext[] = [];
let grantContext: GrantContext[] = [];

export function setResourceContext(resources: ResourceContext[]): void {
  resourceContext = resources;
}

export function setGrantContext(grants: GrantContext[]): void {
  grantContext = grants;
}

export function clearConversation(): void {
  messages = [];
}

export async function sendMessage(userText: string): Promise<ChatResponse> {
  messages.push({ role: "user", content: userText });

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      resourceContext,
      grantContext,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // Remove the failed user message
    messages.pop();
    throw new Error(err.error || "Chat request failed");
  }

  const data = await res.json();
  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: data.content,
  };
  messages.push(assistantMessage);

  return {
    content: data.content,
    toolUses: data.toolUses,
  };
}
