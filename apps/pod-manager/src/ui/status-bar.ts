import type { SpiderProgress } from "../pod-spider.js";

export function renderStatusBar(
  container: HTMLElement,
  progress: SpiderProgress
): void {
  container.classList.remove("hidden");
  container.innerHTML = `
    <div class="status-content">
      <span class="spinner"></span>
      Scanning pod: ${progress.fetched} containers fetched,
      ${progress.discovered} resources discovered
      ${progress.errors > 0 ? `, ${progress.errors} skipped (403)` : ""}
    </div>
  `;
}

export function renderStatusDone(
  container: HTMLElement,
  total: number
): void {
  container.innerHTML = `
    <div class="status-content status-done">
      Scan complete: ${total} resources found
    </div>
  `;
}

export function renderStatusError(
  container: HTMLElement,
  message: string
): void {
  container.innerHTML = `
    <div class="status-content status-error">
      Error: ${message}
    </div>
  `;
}
