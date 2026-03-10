import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import express from "express";
import cookieSession from "cookie-session";
import { authRouter } from "./auth.js";
import { apiRouter } from "./routes.js";

const app = express();
const PORT = 5174;
const isDev = process.env.NODE_ENV !== "production";

// Session middleware
app.use(
  cookieSession({
    name: "session",
    keys: [process.env.SESSION_SECRET || "dev-secret-change-in-production"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
);

app.use(express.json());

// Auth routes
app.use("/auth", authRouter);

// API routes
app.use("/api", apiRouter);

// Frontend serving
if (isDev) {
  // In dev mode, proxy to Vite dev server
  const { createProxyMiddleware } = await import("http-proxy-middleware");
  app.use(
    "/",
    createProxyMiddleware({
      target: "http://localhost:5175",
      changeOrigin: true,
      ws: true, // WebSocket support for Vite HMR
    })
  );
} else {
  // In production, serve built static files
  app.use(express.static(path.join(__dirname, "../dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Data Requester server running at http://localhost:${PORT}`);
});
