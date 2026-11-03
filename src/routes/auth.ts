import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getDefaultUserRole } from "../lib/access";
import { createAuthToken } from "../lib/authToken";

export const authRouter = Router();

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

const registerSchema = z.object({
  email: z.string().email(),
  fullname: z.string().min(1).max(200),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(100),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const errorMessages: string[] = [];

      if (fieldErrors.email) errorMessages.push(`Email: ${fieldErrors.email.join(", ")}`);
      if (fieldErrors.fullname) errorMessages.push(`Full name: ${fieldErrors.fullname.join(", ")}`);
      if (fieldErrors.password) errorMessages.push(`Password must be at least 8 characters`);

      const message = errorMessages.length > 0 ? errorMessages.join(". ") : "Validation failed";
      res.status(400).json({ error: message });
      return;
    }

    const { email, fullname, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: fullname.trim(),
        passwordHash,
        role: getDefaultUserRole(normalizedEmail),
      },
      select: publicUserSelect,
    });

    res.status(201).json({ user, token: createAuthToken(user.id) });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const defaultRole = getDefaultUserRole(normalizedEmail);
    const publicUser =
      defaultRole !== "USER" && user.role !== defaultRole
        ? await prisma.user.update({
            where: { id: user.id },
            data: { role: defaultRole },
            select: publicUserSelect,
          })
        : {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          };

    res.json({ user: publicUser, token: createAuthToken(publicUser.id) });
  } catch (e) {
    next(e);
  }
});
