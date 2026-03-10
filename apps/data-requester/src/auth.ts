import { Session } from "@inrupt/solid-client-authn-browser";

const OIDC_ISSUER = "https://login.inrupt.com";
const CLIENT_ID = import.meta.env.VITE_SOLID_CLIENT_ID;

const session = new Session();

export async function initAuth(): Promise<void> {
  await session.handleIncomingRedirect({ restorePreviousSession: true });
}

export function login(): void {
  session.login({
    oidcIssuer: OIDC_ISSUER,
    redirectUrl: window.location.href,
    tokenType: "Bearer",
    clientId: CLIENT_ID,
  });
}

export function logout(): void {
  session.logout();
}

export function isLoggedIn(): boolean {
  return session.info.isLoggedIn === true;
}

export function getWebId(): string | undefined {
  return session.info.webId;
}

export function getAuthFetch(): typeof fetch {
  return session.fetch;
}

export { session };
