export interface PodResource {
  url: string;
  type: "container" | "resource";
  contentType?: string;
  modified?: string;
}

export interface PodIndex {
  webId: string;
  podUrl: string;
  resources: PodResource[];
  updatedAt: string;
}

export interface DirectoryEntry {
  webId: string;
  name?: string;
  podUrl?: string;
  registeredAt: string;
  index?: PodIndex;
}
