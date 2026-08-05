import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../modules/auth/tokens";

export interface AuthedRequest extends Request {
  auth?: { userId: string; email: string; roleId: string | null };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.auth = { userId: payload.sub, email: payload.email, roleId: payload.roleId };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}
