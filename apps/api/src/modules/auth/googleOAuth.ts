import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env";

const client = new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleCallbackUrl);

export function getGoogleAuthUrl(state: string): string {
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
  });
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error("No id_token returned from Google");
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) throw new Error("Incomplete Google profile");
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture,
  };
}
