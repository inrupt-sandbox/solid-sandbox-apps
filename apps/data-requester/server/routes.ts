import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  query,
  getFile,
  overwriteFile,
  getSolidDataset as getSolidDatasetWithGrant,
  getId,
  getResourceOwner,
  getResources,
  getAccessModes,
  getExpirationDate,
  getIssuanceDate,
  issueAccessRequest,
  type CredentialResult,
} from "@inrupt/solid-client-access-grants";
import { getPodUrlAll, getSolidDataset, getContainedResourceUrlAll } from "@inrupt/solid-client";
import { parsePodIndexFromDataset, DiscoveryClient, VC_QUERY_ENDPOINT, formatModes } from "@solid-ecosystem/shared";
import type { DatasetWithId } from "@inrupt/solid-client-vc";
import { getSessionForRequest } from "./auth.js";

export const apiRouter = Router();
const discovery = new DiscoveryClient();

const TEXT_TYPES = ["text/", "application/json", "application/ld+json", "text/turtle"];

function isTextContent(contentType: string): boolean {
  return TEXT_TYPES.some((t) => contentType.startsWith(t));
}

// ---------- Grants ----------

apiRouter.get("/grants", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  try {
    const result: CredentialResult = await query(
      { type: "SolidAccessGrant", status: "Active" },
      { fetch: session.fetch, queryEndpoint: VC_QUERY_ENDPOINT }
    );

    const grants = result.items.map((vc) => {
      const expDate = getExpirationDate(vc);
      const issDate = getIssuanceDate(vc);
      return {
        id: getId(vc),
        ownerWebId: getResourceOwner(vc) ?? "Unknown",
        resourceUrls: getResources(vc).map(String),
        modes: formatModes(getAccessModes(vc)),
        expiresAt: expDate ? expDate.toISOString() : null,
        issuedAt: issDate ? issDate.toISOString() : null,
      };
    });

    // Store VCs in memory keyed by grant ID for later resource fetching
    for (const vc of result.items) {
      grantVcCache.set(getId(vc), vc);
    }

    res.json(grants);
  } catch (err: any) {
    console.error("Failed to fetch grants:", err);
    res.status(500).json({ error: err.message });
  }
});

// Cache grant VCs for resource fetching (keyed by grant ID)
const grantVcCache = new Map<string, DatasetWithId>();

// ---------- Fetch Resource ----------

apiRouter.post("/fetch-resource", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const { resourceUrl, grantId } = req.body;
  if (!resourceUrl || !grantId) {
    return res.status(400).json({ error: "resourceUrl and grantId required" });
  }

  const grantVc = grantVcCache.get(grantId);
  if (!grantVc) {
    return res.status(404).json({ error: "Grant not found. Please refresh grants." });
  }

  try {
    const blob = await getFile(resourceUrl, grantVc, { fetch: session.fetch });
    const contentType = blob.type || "application/octet-stream";

    if (isTextContent(contentType)) {
      const text = await blob.text();
      res.json({ contentType, text, blobUrl: null });
    } else {
      // For binary content, send as buffer
      const buffer = Buffer.from(await blob.arrayBuffer());
      res.set("Content-Type", contentType);
      res.send(buffer);
    }
  } catch (err: any) {
    console.error("Failed to fetch resource:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- List Container ----------

apiRouter.post("/list-container", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const { containerUrl, grantId } = req.body;
  if (!containerUrl || !grantId) {
    return res.status(400).json({ error: "containerUrl and grantId required" });
  }

  const grantVc = grantVcCache.get(grantId);
  if (!grantVc) {
    return res.status(404).json({ error: "Grant not found. Please refresh grants." });
  }

  try {
    const dataset = await getSolidDatasetWithGrant(containerUrl, grantVc, {
      fetch: session.fetch,
    });
    const contained = getContainedResourceUrlAll(dataset);
    res.json(contained);
  } catch (err: any) {
    console.error("Failed to list container:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Chat ----------

let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    anthropic = new Anthropic();
  }
  return anthropic;
}

interface GrantContext {
  grantId: string;
  resourceUrls: string[];
  modes: string[];
}

const saveMemoryTool: Anthropic.Tool = {
  name: "save_memory",
  description:
    "Save a memorable insight, summary, or study note to the user's memory.ttl file on their Solid Pod. Use this proactively when the conversation produces something worth remembering — key concepts, summaries, study notes, or important conclusions.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Short title for the memory entry" },
      content: { type: "string", description: "The content to save" },
    },
    required: ["title", "content"],
  },
};

function escapeTurtleLiteral(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"""/g, '\\"\\"\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function derivePodRoot(resourceUrls: string[]): string {
  // Pod root is the scheme + host + first path segment (e.g. https://storage.inrupt.com/uuid/)
  for (const url of resourceUrls) {
    try {
      const u = new URL(url);
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        return `${u.origin}/${segments[0]}/`;
      }
      return `${u.origin}/`;
    } catch {
      continue;
    }
  }
  throw new Error("Cannot derive pod root from grant resource URLs");
}

async function executeSaveMemory(
  session: { fetch: typeof globalThis.fetch },
  writeGrantVc: DatasetWithId,
  readGrantVc: DatasetWithId | null,
  podRoot: string,
  title: string,
  content: string
): Promise<void> {
  const memoryUrl = `${podRoot}memory.ttl`;

  let existing = "";
  // Try to read existing memory.ttl using a read grant if available
  if (readGrantVc) {
    try {
      const blob = await getFile(memoryUrl, readGrantVc, { fetch: session.fetch });
      existing = await blob.text();
    } catch {
      // File doesn't exist yet or read grant doesn't cover it
    }
  }

  if (!existing) {
    existing = `@prefix schema: <http://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix mem: <#> .
`;
  }

  const id = `entry-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const triple = `
mem:${id} a schema:LearningResource ;
  schema:name "${escapeTurtleLiteral(title)}" ;
  schema:text "${escapeTurtleLiteral(content)}" ;
  schema:dateCreated "${timestamp}"^^xsd:dateTime .
`;
  const updated = existing + triple;

  const blob = new Blob([updated], { type: "text/turtle" });
  await overwriteFile(memoryUrl, blob, writeGrantVc, {
    contentType: "text/turtle",
    fetch: session.fetch,
  });
}

apiRouter.post("/chat", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const { messages, resourceContext, grantContext } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const client = getAnthropicClient();

    // Check if any grant has Write mode
    const grants: GrantContext[] = grantContext ?? [];
    const writeGrant = grants.find((g) =>
      g.modes.some((m) => m.toLowerCase().includes("write"))
    );
    const readGrant = grants.find((g) =>
      g.modes.some((m) => m.toLowerCase().includes("read"))
    );
    const hasWriteAccess = !!writeGrant;

    let systemPrompt =
      "You are a helpful AI tutor that answers questions about data stored in Solid Pods. The user has been granted access to the following resources. Use them to answer questions.\n";

    if (hasWriteAccess) {
      systemPrompt +=
        "\nYou have the ability to save memorable insights to the user's memory.ttl file on their pod using the save_memory tool. Use it proactively when the conversation produces something worth remembering — key concepts, summaries, study notes, or important conclusions. You don't need to ask permission; just save when it's useful. IMPORTANT: Always also provide a full text response to the user — saving a memory should happen alongside your answer, not instead of it.\n";
    }

    if (resourceContext && Array.isArray(resourceContext) && resourceContext.length > 0) {
      for (const rc of resourceContext) {
        systemPrompt += `\n--- Resource: ${rc.url} (${rc.contentType}) ---\n${rc.text}\n`;
      }
    } else {
      systemPrompt += "\nNo resource context has been loaded yet.";
    }

    const tools: Anthropic.Tool[] = hasWriteAccess ? [saveMemoryTool] : [];
    const toolUses: Array<{ tool: string; title: string }> = [];

    let apiMessages: Anthropic.MessageParam[] = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: apiMessages,
        ...(tools.length > 0 ? { tools } : {}),
      });

      if (response.stop_reason === "tool_use") {
        const toolUseBlock = response.content.find(
          (c): c is Anthropic.ContentBlock & { type: "tool_use" } => c.type === "tool_use"
        );

        if (toolUseBlock && toolUseBlock.name === "save_memory" && writeGrant) {
          const input = toolUseBlock.input as { title: string; content: string };
          let resultText: string;

          try {
            const writeGrantVc = grantVcCache.get(writeGrant.grantId);
            if (!writeGrantVc) throw new Error("Write grant VC not found in cache");
            const readGrantVc = readGrant ? grantVcCache.get(readGrant.grantId) ?? null : null;

            // Resolve the pod root from the resource owner's WebID
            const ownerWebId = getResourceOwner(writeGrantVc);
            let podRoot: string;
            if (ownerWebId) {
              const podUrls = await getPodUrlAll(ownerWebId, { fetch: session.fetch });
              podRoot = podUrls[0] ?? derivePodRoot(writeGrant.resourceUrls);
            } else {
              podRoot = derivePodRoot(writeGrant.resourceUrls);
            }

            await executeSaveMemory(session, writeGrantVc, readGrantVc, podRoot, input.title, input.content);
            toolUses.push({ tool: "save_memory", title: input.title });
            resultText = `Successfully saved "${input.title}" to memory.ttl`;
          } catch (err: any) {
            console.error("save_memory failed:", err);
            resultText = `Failed to save memory: ${err.message}`;
          }

          // Append assistant response + tool result, then loop
          apiMessages = [
            ...apiMessages,
            { role: "assistant", content: response.content },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUseBlock.id,
                  content: resultText,
                },
              ],
            },
          ];
          continue;
        }
      }

      // stop_reason is "end_turn" or no tool_use we handle — extract text and return
      const textContent = response.content.find((c) => c.type === "text");
      return res.json({
        role: "assistant",
        content: textContent?.text ?? "",
        toolUses: toolUses.length > 0 ? toolUses : undefined,
      });
    }

    // Max iterations reached — return whatever we have
    res.json({
      role: "assistant",
      content: "I wasn't able to complete my response within the allowed steps.",
      toolUses: toolUses.length > 0 ? toolUses : undefined,
    });
  } catch (err: any) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Discovery proxies ----------

apiRouter.get("/search", async (req, res) => {
  const q = req.query.q as string;
  if (!q) return res.status(400).json({ error: "q parameter required" });

  try {
    const results = await discovery.search(q);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/directory", async (_req, res) => {
  try {
    const results = await discovery.getDirectory();
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/lookup", async (req, res) => {
  const webId = req.query.webId as string;
  if (!webId) return res.status(400).json({ error: "webId parameter required" });

  try {
    const result = await discovery.lookup(webId);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Access Requests ----------

apiRouter.post("/request-access", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const { resourceUrls, ownerWebId, modes, purpose } = req.body;
  if (!resourceUrls || !ownerWebId || !modes) {
    return res.status(400).json({ error: "resourceUrls, ownerWebId, and modes required" });
  }

  try {
    const hasContainers = resourceUrls.some((u: string) => u.endsWith("/"));

    const params: any = {
      access: {
        read: modes.includes("Read"),
        write: modes.includes("Write"),
        append: modes.includes("Append"),
      },
      resources: resourceUrls,
      resourceOwner: ownerWebId,
      inherit: hasContainers,
    };

    if (purpose) {
      const purposeUrl = looksLikeUrl(purpose)
        ? purpose
        : `https://example.com/${encodeURIComponent(purpose)}`;
      params.purpose = [purposeUrl];
    }

    const result = await issueAccessRequest(params, {
      fetch: session.fetch,
      returnLegacyJsonld: false,
    });

    res.json({ success: true, id: getId(result) });
  } catch (err: any) {
    console.error("Failed to issue access request:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Pod Root ----------

apiRouter.get("/pod-root", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const webId = req.query.webId as string;
  if (!webId) return res.status(400).json({ error: "webId parameter required" });

  try {
    const podUrls = await getPodUrlAll(webId, { fetch: session.fetch });
    if (podUrls.length === 0) {
      return res.status(404).json({ error: "No pod found for this WebID" });
    }
    res.json({ podRoot: podUrls[0] });
  } catch (err: any) {
    console.error("Failed to resolve pod root:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Pod Index ----------

apiRouter.get("/pod-index", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const webId = req.query.webId as string;
  if (!webId) return res.status(400).json({ error: "webId parameter required" });

  try {
    // Strategy 1: Direct fetch
    const podUrls = await getPodUrlAll(webId, { fetch: session.fetch });

    for (const podUrl of podUrls) {
      const indexUrl = podUrl.endsWith("/")
        ? `${podUrl}public-index.ttl`
        : `${podUrl}/public-index.ttl`;

      try {
        const dataset = await getSolidDataset(indexUrl, { fetch: session.fetch });
        const index = parsePodIndexFromDataset(dataset, indexUrl);
        if (index) return res.json(index);
      } catch {
        // Try next pod URL
      }
    }
  } catch {
    // Fall through to discovery
  }

  // Strategy 2: Discovery server
  try {
    const entries = await discovery.search(webId);
    const match = entries.find((e) => e.webId === webId);
    if (match?.index) return res.json(match.index);
  } catch {
    // Discovery server might be offline
  }

  res.json(null);
});

// ---------- Helpers ----------

function looksLikeUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

