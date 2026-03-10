import { escapeHtml } from "@solid-ecosystem/shared";

export function renderRequestForm(
  container: HTMLElement,
  resourceUrls: string[],
  ownerWebId: string,
  onSubmit: (modes: ("Read" | "Write" | "Append")[], purpose: string) => void
): void {
  container.innerHTML = `
    <div class="request-form-content">
      <p>Requesting access from: <strong>${escapeHtml(ownerWebId)}</strong></p>
      <p>Resources (${resourceUrls.length}):</p>
      <ul class="resource-url-list">
        ${resourceUrls.map((u) => `<li>${escapeHtml(u)}</li>`).join("")}
      </ul>
      <div class="form-group">
        <label>Access modes:</label>
        <label class="checkbox-label"><input type="checkbox" value="Read" checked /> Read</label>
        <label class="checkbox-label"><input type="checkbox" value="Write" /> Write</label>
        <label class="checkbox-label"><input type="checkbox" value="Append" /> Append</label>
      </div>
      <div class="form-group">
        <label for="purpose-input">Purpose (optional):</label>
        <input type="text" id="purpose-input" class="input" placeholder="Why do you need access?" />
      </div>
      <button id="submit-request-btn" class="btn btn-primary">Send Access Request</button>
      <div id="request-status"></div>
    </div>
  `;

  document
    .getElementById("submit-request-btn")!
    .addEventListener("click", () => {
      const checkboxes = container.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:checked'
      );
      const modes = Array.from(checkboxes).map(
        (cb) => cb.value as "Read" | "Write" | "Append"
      );
      const purpose = (
        document.getElementById("purpose-input") as HTMLInputElement
      ).value.trim();

      if (modes.length === 0) {
        document.getElementById("request-status")!.innerHTML =
          '<p class="error">Select at least one access mode.</p>';
        return;
      }

      onSubmit(modes, purpose);
    });
}
