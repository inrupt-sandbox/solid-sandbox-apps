import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { DirectoryEntry, PodIndex } from "@solid-ecosystem/shared";

const DATA_FILE = "data/directory.json";

export class Store {
  private entries: Map<string, DirectoryEntry> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(DATA_FILE)) {
        const data = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
        for (const entry of data) {
          this.entries.set(entry.webId, entry);
        }
      }
    } catch {
      // Start fresh if file is corrupt
    }
  }

  private persist(): void {
    const dir = dirname(DATA_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify(this.getAll(), null, 2));
  }

  register(webId: string, name?: string): DirectoryEntry {
    const existing = this.entries.get(webId);
    const entry: DirectoryEntry = {
      webId,
      name: name ?? existing?.name,
      podUrl: existing?.podUrl,
      registeredAt: existing?.registeredAt ?? new Date().toISOString(),
      index: existing?.index,
    };
    this.entries.set(webId, entry);
    this.persist();
    return entry;
  }

  updateIndex(webId: string, index: PodIndex): void {
    const entry = this.entries.get(webId);
    if (entry) {
      entry.index = index;
      entry.podUrl = index.podUrl;
      this.persist();
    }
  }

  get(webId: string): DirectoryEntry | undefined {
    return this.entries.get(webId);
  }

  getAll(): DirectoryEntry[] {
    return Array.from(this.entries.values());
  }

  search(query: string): DirectoryEntry[] {
    const q = query.toLowerCase();
    return this.getAll().filter((entry) => {
      if (entry.webId.toLowerCase().includes(q)) return true;
      if (entry.name?.toLowerCase().includes(q)) return true;
      if (
        entry.index?.resources.some((r) => r.url.toLowerCase().includes(q))
      )
        return true;
      return false;
    });
  }
}
