import {
  saveFileInContainer,
  getSourceUrl,
  getFile,
  deleteFile,
} from "@inrupt/solid-client";

export interface UploadResult {
  fileName: string;
  url: string;
}

export async function uploadFile(
  file: File,
  containerUrl: string,
  authFetch: typeof fetch
): Promise<UploadResult> {
  const savedFile = await saveFileInContainer(containerUrl, file, {
    contentType: file.type || "application/octet-stream",
    fetch: authFetch,
  });

  const url = getSourceUrl(savedFile) ?? `${containerUrl}${file.name}`;

  return { fileName: file.name, url };
}

export async function moveResource(
  sourceUrl: string,
  destinationContainerUrl: string,
  authFetch: typeof fetch
): Promise<string> {
  // Fetch the file content
  const file = await getFile(sourceUrl, { fetch: authFetch });

  // Derive the file name from the source URL
  const fileName = decodeURIComponent(
    sourceUrl.split("/").filter(Boolean).pop() ?? "unnamed"
  );

  // Save into the destination container
  const blob = new File([file], fileName, { type: file.type || "application/octet-stream" });
  const savedFile = await saveFileInContainer(destinationContainerUrl, blob, {
    contentType: file.type || "application/octet-stream",
    fetch: authFetch,
  });

  // Delete the original
  await deleteFile(sourceUrl, { fetch: authFetch });

  return getSourceUrl(savedFile) ?? `${destinationContainerUrl}${fileName}`;
}
