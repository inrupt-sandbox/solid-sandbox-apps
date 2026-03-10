let loggedIn = false;
let webId: string | undefined;

export async function initAuth(): Promise<void> {
  try {
    const res = await fetch("/auth/status");
    const data = await res.json();
    loggedIn = data.loggedIn === true;
    webId = data.webId;
  } catch {
    loggedIn = false;
  }
}

export function login(): void {
  window.location.href = "/auth/login";
}

export function logout(): void {
  window.location.href = "/auth/logout";
}

export function isLoggedIn(): boolean {
  return loggedIn;
}

export function getWebId(): string | undefined {
  return webId;
}
