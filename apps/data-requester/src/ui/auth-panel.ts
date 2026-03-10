import { login, logout, isLoggedIn, getWebId } from "../auth.js";

export function renderAuthPanel(container: HTMLElement): void {
  container.innerHTML = "";

  if (isLoggedIn()) {
    const webId = getWebId();
    container.innerHTML = `
      <span class="user-info">Logged in as <strong>${webId}</strong></span>
      <button id="logout-btn" class="btn btn-secondary">Logout</button>
    `;
    container.querySelector("#logout-btn")!.addEventListener("click", logout);
  } else {
    container.innerHTML = `
      <button id="login-btn" class="btn btn-primary">Login with Inrupt</button>
    `;
    container.querySelector("#login-btn")!.addEventListener("click", login);
  }
}
