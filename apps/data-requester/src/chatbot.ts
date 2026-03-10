interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ResourceContext {
  url: string;
  contentType: string;
  text: string;
}

let messages: ChatMessage[] = [];
let resourceContext: ResourceContext[] = [];

export function setResourceContext(resources: ResourceContext[]): void {
  resourceContext = resources;
}

export function clearConversation(): void {
  messages = [];
}

export async function sendMessage(userText: string): Promise<string> {
  messages.push({ role: "user", content: userText });

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      resourceContext,
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

  return data.content;
}
