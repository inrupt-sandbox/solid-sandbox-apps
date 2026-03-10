import { uploadFile } from "../uploader.js";

let currentContainer: string | null = null;
let panelEl: HTMLElement | null = null;
let authFetchRef: typeof fetch | null = null;
let onCompleteRef: (() => void) | null = null;

export function initUploadPanel(
  container: HTMLElement,
  authFetch: typeof fetch,
  onUploadComplete: () => void
): void {
  panelEl = container;
  authFetchRef = authFetch;
  onCompleteRef = onUploadComplete;
  container.className = "upload-area";
  renderEmpty();
}

export function setUploadTarget(containerUrl: string): void {
  currentContainer = containerUrl;
  if (panelEl) renderActive();
}

function renderEmpty(): void {
  if (!panelEl) return;
  panelEl.innerHTML = `<p class="upload-hint-text">Select a folder to upload files</p>`;
}

function renderActive(): void {
  if (!panelEl || !currentContainer) return;

  const path = new URL(currentContainer).pathname;
  panelEl.innerHTML = "";

  // Target indicator
  const targetDiv = document.createElement("div");
  targetDiv.className = "upload-target-label";
  targetDiv.innerHTML = `Upload to <strong>${escapeHtml(path)}</strong>`;
  panelEl.appendChild(targetDiv);

  // Compact dropzone
  const dropzone = document.createElement("div");
  dropzone.className = "upload-dropzone";
  dropzone.innerHTML = `<p>Drop files here or click to browse</p>`;
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  dropzone.appendChild(fileInput);
  panelEl.appendChild(dropzone);

  // Progress area
  const progressArea = document.createElement("div");
  progressArea.className = "upload-progress";
  panelEl.appendChild(progressArea);

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer?.files.length) {
      handleFiles(Array.from(e.dataTransfer.files), progressArea);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) {
      handleFiles(Array.from(fileInput.files), progressArea);
      fileInput.value = "";
    }
  });
}

async function handleFiles(files: File[], progressArea: HTMLElement): Promise<void> {
  if (!currentContainer || !authFetchRef) return;

  for (const file of files) {
    const item = document.createElement("div");
    item.className = "upload-file-item";
    item.innerHTML = `
      <span class="upload-file-name">${escapeHtml(file.name)}</span>
      <span class="upload-file-status uploading">uploading</span>
    `;
    progressArea.prepend(item);

    const statusEl = item.querySelector(".upload-file-status") as HTMLElement;

    try {
      await uploadFile(file, currentContainer, authFetchRef);
      statusEl.textContent = "done";
      statusEl.className = "upload-file-status done";
    } catch (err: any) {
      statusEl.textContent = "failed";
      statusEl.className = "upload-file-status error";
      statusEl.title = err.message;
      console.error(`Upload failed for ${file.name}:`, err);
    }
  }

  onCompleteRef?.();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
