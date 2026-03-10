export const SOLID = {
  publicTypeIndex: "http://www.w3.org/ns/solid/terms#publicTypeIndex",
  instance: "http://www.w3.org/ns/solid/terms#instance",
  forClass: "http://www.w3.org/ns/solid/terms#forClass",
} as const;

export const LDP = {
  contains: "http://www.w3.org/ns/ldp#contains",
  Container: "http://www.w3.org/ns/ldp#Container",
  Resource: "http://www.w3.org/ns/ldp#Resource",
  BasicContainer: "http://www.w3.org/ns/ldp#BasicContainer",
} as const;

export const RDF = {
  type: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
} as const;

export const DCTERMS = {
  modified: "http://purl.org/dc/terms/modified",
} as const;

export const FOAF = {
  name: "http://xmlns.com/foaf/0.1/name",
} as const;

export const POD_INDEX = {
  PodIndex: "http://example.org/pod-index#PodIndex",
  PodResource: "http://example.org/pod-index#PodResource",
  webId: "http://example.org/pod-index#webId",
  podUrl: "http://example.org/pod-index#podUrl",
  resource: "http://example.org/pod-index#resource",
  resourceUrl: "http://example.org/pod-index#resourceUrl",
  resourceType: "http://example.org/pod-index#resourceType",
  contentType: "http://example.org/pod-index#contentType",
  updatedAt: "http://example.org/pod-index#updatedAt",
} as const;
