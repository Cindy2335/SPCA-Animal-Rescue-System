import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getRequestUser } from "../lib/authToken";
import { notificationSelect } from "../lib/notifications";

export const notificationRouter = Router();

notificationRouter.get("/", async (req, res, next) => {
  try {
    const auth = await getRequestUser(req);

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user) {
      res.status(401).json({ error: "Sign in to view notifications" });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { recipientId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: notificationSelect,
    });

    res.json({ notifications });
  } catch (e) {
    next(e);
  }
});

notificationRouter.patch("/read-all", async (req, res, next) => {
  try {
    const auth = await getRequestUser(req);

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user) {
      res.status(401).json({ error: "Sign in to update notifications" });
      return;
    }

    await prisma.notification.updateMany({
      where: { recipientId: auth.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    const notifications = await prisma.notification.findMany({
      where: { recipientId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: notificationSelect,
    });

    res.json({ notifications });
  } catch (e) {
    next(e);
  }
});

notificationRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const auth = await getRequestUser(req);

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user) {
      res.status(401).json({ error: "Sign in to update notifications" });
      return;
    }

    const existing = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        recipientId: auth.user.id,
      },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
      select: notificationSelect,
    });

    res.json({ notification });
  } catch (e) {
    next(e);
  }
});
