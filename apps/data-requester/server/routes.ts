import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  query,
  getFile,
  getId,
  getResourceOwner,
  getResources,
  getAccessModes,
  getExpirationDate,
  getIssuanceDate,
  issueAccessRequest,
  type CredentialResult,
} from "@inrupt/solid-client-access-grants";
import { getPodUrlAll, getSolidDataset } from "@inrupt/solid-client";
import { parsePodIndexFromDataset, DiscoveryClient } from "@solid-ecosystem/shared";
import type { DatasetWithId } from "@inrupt/solid-client-vc";
import { getSessionForRequest } from "./auth.js";

export const apiRouter = Router();

const QUERY_ENDPOINT = new URL("https://vc.inrupt.com/query");
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
      { fetch: session.fetch, queryEndpoint: QUERY_ENDPOINT }
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

apiRouter.post("/chat", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const { messages, resourceContext } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const client = getAnthropicClient();

    let systemPrompt = "You are a helpful assistant that answers questions about data stored in Solid Pods. The user has been granted access to the following resources. Use them to answer questions.\n";

    if (resourceContext && Array.isArray(resourceContext) && resourceContext.length > 0) {
      for (const rc of resourceContext) {
        systemPrompt += `\n--- Resource: ${rc.url} (${rc.contentType}) ---\n${rc.text}\n`;
      }
    } else {
      systemPrompt += "\nNo resource context has been loaded yet.";
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find((c) => c.type === "text");
    res.json({
      role: "assistant",
      content: textContent?.text ?? "",
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

function formatModes(modes: { read?: boolean; write?: boolean; append?: boolean }): string[] {
  const result: string[] = [];
  if (modes.read) result.push("Read");
  if (modes.write) result.push("Write");
  if (modes.append) result.push("Append");
  return result;
}
