import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from '../lib/prisma';
import { canViewAll, getDefaultUserRole } from "../lib/access";
import { getRequestUser } from "../lib/authToken";


export const userRouter = Router();

const createUserSchema = z.object({
    email: z.string().email(),
    fullname: z.string().min(1).max(200),
    password: z.string().min(8).max(100),
});

userRouter.post("/", async (req, res,next) => {
try{

    const parsed = createUserSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ error:"Validation Failed",details: parsed.error.flatten() });
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
        select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            createdAt: true,
        },
        });
        res.status(201).json(user);
}
catch(e)
{
    next(e);
}
});

userRouter.get("/field-agents", async (req, res, next) => {
    try {
        const auth = await getRequestUser(req);

        if (auth.error) {
            res.status(401).json({ error: auth.error });
            return;
        }

        if (!auth.user || !canViewAll(auth.user.role)) {
            res.status(403).json({ error: "Only admins can view field agents" });
            return;
        }

        const users = await prisma.user.findMany({
            where: { role: "FIELD_AGENT" },
            orderBy: { fullName: "asc" },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.json({ users });
    } catch (e) {
        next(e);
    }
});

userRouter.get("/:id", async (req, res,next) => {
    try{
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.json(user);
    }
    catch(e)
    {
        next(e);
    }
});
