import type { DirectoryEntry } from "./types.js";

const DEFAULT_BASE = "http://localhost:3001";

export class DiscoveryClient {
  constructor(private baseUrl: string = DEFAULT_BASE) {}

  async register(webId: string, name?: string, podUrl?: string): Promise<DirectoryEntry> {
    const res = await fetch(`${this.baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webId, name, podUrl }),
    });
    if (!res.ok) throw new Error(`Register failed: ${res.status}`);
    return res.json() as Promise<DirectoryEntry>;
  }

  async lookup(webId: string): Promise<DirectoryEntry | null> {
    const res = await fetch(
      `${this.baseUrl}/lookup?webId=${encodeURIComponent(webId)}`
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lookup failed: ${res.status}`);
    return res.json() as Promise<DirectoryEntry>;
  }

  async refreshIndex(webId: string, podUrl?: string): Promise<DirectoryEntry> {
    const res = await fetch(`${this.baseUrl}/refresh-index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webId, podUrl }),
    });
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
    return res.json() as Promise<DirectoryEntry>;
  }

  async getDirectory(): Promise<DirectoryEntry[]> {
    const res = await fetch(`${this.baseUrl}/directory`);
    if (!res.ok) throw new Error(`Directory fetch failed: ${res.status}`);
    return res.json() as Promise<DirectoryEntry[]>;
  }

  async search(query: string): Promise<DirectoryEntry[]> {
    const res = await fetch(
      `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json() as Promise<DirectoryEntry[]>;
  }
}
