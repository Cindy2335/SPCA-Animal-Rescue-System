import crypto from "node:crypto";
import type { Request } from "express";
import { getDefaultUserRole } from "./access";
import { prisma } from "./prisma";

const tokenSecret = process.env.AUTH_TOKEN_SECRET ?? "dev-spca-auth-token-secret";
const tokenTtlDays = Number(process.env.AUTH_TOKEN_TTL_DAYS ?? "30");
const tokenTtlMs = tokenTtlDays * 24 * 60 * 60 * 1000;

type TokenPayload = {
  sub: string;
  iat: number;
};

export type RequestUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string) {
  return crypto.createHmac("sha256", tokenSecret).update(value).digest("base64url");
}

function getBearerToken(req: Request) {
  const header = req.header("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export function createAuthToken(userId: string) {
  const payload: TokenPayload = {
    sub: userId,
    iat: Date.now(),
  };
  const body = base64Url(JSON.stringify(payload));
  const signature = sign(body);

  return `${body}.${signature}`;
}

export function verifyAuthToken(token: string) {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expectedSignature = sign(body);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;

    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }

    if (!Number.isFinite(payload.iat) || Date.now() - payload.iat > tokenTtlMs) {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

export async function getRequestUser(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return { user: null, error: null };
  }

  const userId = verifyAuthToken(token);

  if (!userId) {
    return { user: null, error: "Invalid or expired session" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  });

  if (!user) {
    return { user: null, error: "Session user was not found" };
  }

  const defaultRole = getDefaultUserRole(user.email);
  const role = defaultRole !== "USER" ? defaultRole : user.role;

  return {
    user: {
      ...user,
      role,
    },
    error: null,
  };
}
