import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { getGoogleAuthUrl, exchangeCodeForProfile } from "./googleOAuth";
import { signAccessToken, generateRefreshToken, hashRefreshToken } from "./tokens";
import { writeAuditLog } from "../audit/auditLog";

export const authRouter = Router();

const REFRESH_COOKIE = "workspaceos_refresh";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Step 1: redirect the browser to Google's consent screen.
authRouter.get("/google", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 5 * 60 * 1000 });
  res.redirect(getGoogleAuthUrl(state));
});

// Step 2: Google redirects back here with an auth code.
authRouter.get("/google/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const expectedState = req.cookies?.oauth_state;

  if (!code || !state || state !== expectedState) {
    return res.status(400).send("Invalid OAuth state or missing code.");
  }

  try {
    const profile = await exchangeCodeForProfile(code);

    let user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      // First-time sign-in: create a PENDING account with no role.
      // The Owner must approve + assign a role before this user can see any apps.
      user = await prisma.user.create({
        data: {
          email: profile.email,
          googleSub: profile.sub,
          displayName: profile.name,
          avatarUrl: profile.picture,
          status: profile.email === env.ownerEmail ? "active" : "pending",
        },
      });

      // Bootstrap: if this is the configured OWNER_EMAIL, auto-assign the Owner role.
      if (profile.email === env.ownerEmail) {
        const ownerRole = await prisma.role.findUnique({ where: { name: "Owner" } });
        if (ownerRole) {
          user = await prisma.user.update({ where: { id: user.id }, data: { roleId: ownerRole.id } });
        }
      }

      await writeAuditLog({ actorUserId: user.id, action: "user.signup", targetType: "user", targetId: user.id });
    }

    if (user.status === "disabled") {
      return res.status(403).send("This account has been disabled by the Owner.");
    }

    if (user.status === "pending") {
      // Let them land on a "waiting for approval" page instead of the dashboard.
      return res.redirect(`${env.appUrl}/pending-approval`);
    }

    // Issue our own session: short-lived access JWT + server-tracked refresh token.
    const accessToken = signAccessToken({ sub: user.id, email: user.email, roleId: user.roleId });
    const refreshToken = generateRefreshToken();

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAuditLog({ actorUserId: user.id, action: "user.login", targetType: "user", targetId: user.id, ip: req.ip });

    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: REFRESH_TTL_MS,
    });

    res.redirect(`${env.appUrl}/auth/callback?access_token=${accessToken}`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    res.status(500).send("Authentication failed.");
  }
});

// Exchange a valid refresh cookie for a new access token.
authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  const hash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  if (!session || session.user.status !== "active") {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const accessToken = signAccessToken({ sub: session.user.id, email: session.user.email, roleId: session.user.roleId });
  res.json({ accessToken });
});

// Revoke the current session (logout).
authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (refreshToken) {
    const hash = hashRefreshToken(refreshToken);
    await prisma.session.updateMany({ where: { refreshTokenHash: hash }, data: { revokedAt: new Date() } });
  }
  res.clearCookie(REFRESH_COOKIE);
  res.json({ ok: true });
});
