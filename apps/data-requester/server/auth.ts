import { Router } from "express";
import { Session, logout as solidLogout } from "@inrupt/solid-client-authn-node";
import { custom } from "openid-client";

// Increase OIDC discovery timeout from default 3500ms to 15s
custom.setHttpOptionsDefaults({ timeout: 15000 });

const OIDC_ISSUER = "https://login.inrupt.com";

function getClientId(): string | undefined {
  return process.env.VITE_SOLID_CLIENT_ID;
}

export const authRouter = Router();

// In-memory session cache: sessionId -> authorization state or token set
const sessionCache = new Map<string, any>();

authRouter.get("/login", async (req, res) => {
  const session = new Session({ keepAlive: false });
  req.session!.sessionId = session.info.sessionId;

  session.events.on("authorizationRequest", (authorizationRequestState: any) => {
    sessionCache.set(session.info.sessionId, authorizationRequestState);
  });

  const loginOpts: any = {
    redirectUrl: `http://localhost:5174/auth/callback`,
    oidcIssuer: OIDC_ISSUER,
    tokenType: "Bearer",
    handleRedirect: (url: string) => res.redirect(url),
  };

  const clientId = getClientId();
  if (clientId) {
    loginOpts.clientId = clientId;
  } else {
    loginOpts.clientName = "Data Requester (Dev)";
  }

  try {
    await session.login(loginOpts);
  } catch (err: any) {
    console.error("Login failed:", err.message);
    res.status(502).send(`Login failed: could not reach identity provider. ${err.message}`);
  }
});

authRouter.get("/callback", async (req, res) => {
  const sessionId = req.session?.sessionId;
  if (!sessionId) {
    return res.status(400).send("No session found. Please log in again.");
  }

  const authorizationRequestState = sessionCache.get(sessionId);
  if (!authorizationRequestState) {
    return res.status(400).send("No authorization state found. Please log in again.");
  }

  try {
    const session = await Session.fromAuthorizationRequestState(
      authorizationRequestState,
      sessionId
    );

    session.events.on("newTokens", (tokenSet: any) => {
      sessionCache.set(sessionId, tokenSet);
    });

    await session.handleIncomingRedirect(
      `http://localhost:5174/auth${req.url}`
    );

    if (session.info.isLoggedIn) {
      req.session!.webId = session.info.webId;
      return res.redirect("/");
    }

    res.status(401).send("Login failed.");
  } catch (err: any) {
    console.error("Callback failed:", err.message);
    res.status(500).send(`Authentication callback failed: ${err.message}`);
  }
});

authRouter.get("/status", async (req, res) => {
  const sessionId = req.session?.sessionId;
  const webId = req.session?.webId;

  if (!sessionId || !webId || !sessionCache.has(sessionId)) {
    return res.json({ loggedIn: false });
  }

  res.json({ loggedIn: true, webId });
});

authRouter.get("/logout", async (req, res) => {
  const sessionId = req.session?.sessionId;
  if (sessionId) {
    const tokenSet = sessionCache.get(sessionId);
    sessionCache.delete(sessionId);

    if (tokenSet) {
      try {
        await solidLogout(tokenSet, (url: string) => {
          req.session = null;
          res.redirect(url);
        });
        return;
      } catch {
        // Fall through to simple redirect
      }
    }
  }

  req.session = null;
  res.redirect("/");
});

/**
 * Get an authenticated session for the current request.
 * Returns null if not logged in.
 */
export async function getSessionForRequest(
  req: any
): Promise<Session | null> {
  const sessionId = req.session?.sessionId;
  if (!sessionId) return null;

  const tokenSet = sessionCache.get(sessionId);
  if (!tokenSet) return null;

  try {
    const session = await Session.fromTokens(tokenSet, sessionId);

    // Listen for refreshed tokens
    session.events.on("newTokens", (newTokenSet: any) => {
      sessionCache.set(sessionId, newTokenSet);
    });

    if (session.info.isLoggedIn) {
      return session;
    }
  } catch (err) {
    console.error("Failed to restore session:", err);
    sessionCache.delete(sessionId);
  }

  return null;
}
