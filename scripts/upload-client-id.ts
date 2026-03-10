#!/usr/bin/env npx tsx
/**
 * Uploads a Solid OIDC client ID document (JSON-LD) to a Pod and makes it public.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/upload-client-id.ts [--file path/to/client-id.jsonld]
 *
 * Reads SOLID_CLIENT_ID and SOLID_CLIENT_SECRET from .env (or environment).
 * By default, uploads ./solid-dev-client-id.jsonld to the pod root.
 */

import { Session } from "@inrupt/solid-client-authn-node";
import { getPodUrlAll } from "@inrupt/solid-client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const OIDC_ISSUER = "https://login.inrupt.com";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.error(
      "Usage: npx tsx --env-file=.env scripts/upload-client-id.ts [--file path/to/file.jsonld]"
    );
    process.exit(1);
  }

  const clientId = process.env.SOLID_CLIENT_ID;
  const clientSecret = process.env.SOLID_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Missing SOLID_CLIENT_ID or SOLID_CLIENT_SECRET.\n" +
        "Set them in .env and run with: npx tsx --env-file=.env scripts/upload-client-id.ts"
    );
    process.exit(1);
  }

  // Optional --file flag, defaults to solid-dev-client-id.jsonld in project root
  const fileArgIdx = args.indexOf("--file");
  const filePath =
    fileArgIdx !== -1 && args[fileArgIdx + 1]
      ? resolve(args[fileArgIdx + 1])
      : resolve("solid-dev-client-id.jsonld");

  // 1. Read the client ID document from disk
  let fileContent: string;
  try {
    fileContent = readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error(`Failed to read file: ${filePath}`);
    process.exit(1);
  }

  console.log(`Read client ID document from ${filePath}`);

  // 2. Authenticate with client credentials
  console.log("Authenticating with client credentials...");
  const session = new Session();

  await session.login({
    oidcIssuer: OIDC_ISSUER,
    clientId,
    clientSecret,
    tokenType: "Bearer",
  });

  if (!session.info.isLoggedIn || !session.info.webId) {
    console.error("Authentication failed. Check your client ID and secret.");
    process.exit(1);
  }

  console.log(`Authenticated as ${session.info.webId}`);

  // 3. Discover pod URL
  const podUrls = await getPodUrlAll(session.info.webId, {
    fetch: session.fetch,
  });

  if (podUrls.length === 0) {
    console.error("No pod found for this WebID. Is the pod provisioned?");
    await session.logout();
    process.exit(1);
  }

  const podUrl = podUrls[0];
  console.log(`Pod URL: ${podUrl}`);

  // 4. Determine the target resource URL
  //    Parse the file to find the intended client_id URL, or fall back to pod root + filename
  let parsed: { client_id?: string };
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    parsed = {};
  }

  const filename = filePath.split("/").pop()!;
  let targetUrl: string;

  if (parsed.client_id && !parsed.client_id.includes("<POD_URL>")) {
    // The document already has a concrete client_id URL — upload to that location
    targetUrl = parsed.client_id;
  } else {
    // Replace <POD_URL> placeholder or default to pod root + filename
    targetUrl = `${podUrl}${filename}`;
    // Also update the client_id field in the document so it's self-referencing
    fileContent = fileContent.replace(/<POD_URL>/g, podUrl);
  }

  console.log(`Uploading to: ${targetUrl}`);

  // 5. Upload the file (raw PUT to avoid node-fetch/native Blob incompatibility)
  const putResponse = await session.fetch(targetUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/ld+json" },
    body: fileContent,
  });
  if (!putResponse.ok) {
    console.error(`Upload failed: ${putResponse.status} ${putResponse.statusText}`);
    const body = await putResponse.text();
    if (body) console.error(body);
    await session.logout();
    process.exit(1);
  }

  console.log("Upload complete.");

  // 6. Make the resource publicly readable (dynamic import — ./universal only has an ESM export)
  console.log("Setting public read access...");
  const { setPublicAccess } = await import("@inrupt/solid-client/universal");
  await setPublicAccess(targetUrl, { read: true }, { fetch: session.fetch });

  console.log(`Done! Client ID document is now public at:\n  ${targetUrl}`);

  await session.logout();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
