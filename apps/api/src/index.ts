import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/router";
import { usersRouter } from "./modules/users/router";
import { rolesRouter } from "./modules/roles/router";
import { appsRouter } from "./modules/apps/router";
import { rdpRouter } from "./modules/rdp/router";
import { connectorRouter } from "./modules/connector/router";
import { metricsRouter } from "./modules/metrics/router";
import { auditRouter } from "./modules/audit/router";
import { notesRouter } from "./modules/notes/router";
import { terminalRouter } from "./modules/terminal/router";
import { attachTerminalWebSocketServer } from "./modules/terminal/wsServer";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.appUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Auth endpoints get a tighter rate limit to blunt brute-force / abuse attempts.
app.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), authRouter);

app.use("/users", usersRouter);
app.use("/roles", rolesRouter);
app.use("/apps", appsRouter);
app.use("/rdp", rdpRouter);
app.use("/connector", connectorRouter);
app.use("/metrics", metricsRouter);
app.use("/audit", auditRouter);
app.use("/notes", notesRouter);
app.use("/terminal", terminalRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Phase 5A: an explicit http.Server (instead of app.listen()'s implicit
// one) so the terminal WebSocket can hook the server's "upgrade" event
// directly, on its own path (/terminal/ws), without a second listener/port.
const server = http.createServer(app);
attachTerminalWebSocketServer(server);

server.listen(env.port, () => {
  console.log(`Workspace OS API listening on :${env.port}`);
});
