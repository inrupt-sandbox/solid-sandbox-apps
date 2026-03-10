/** Escape a string for safe insertion into HTML. Handles attributes too (&quot;). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format access mode flags into a human-readable string array. */
export function formatModes(modes: {
  read?: boolean;
  write?: boolean;
  append?: boolean;
}): string[] {
  const result: string[] = [];
  if (modes.read) result.push("Read");
  if (modes.write) result.push("Write");
  if (modes.append) result.push("Append");
  return result;
}
