import { prisma } from "./prisma";

type NotificationInput = {
  body: string;
  reportId?: string | null;
  title: string;
  type: string;
};

type RecipientNotificationInput = NotificationInput & {
  recipientId: string;
};

export const notificationSelect = {
  id: true,
  recipientId: true,
  reportId: true,
  type: true,
  title: true,
  body: true,
  readAt: true,
  createdAt: true,
  report: {
    select: {
      id: true,
      animalType: true,
      condition: true,
      location: true,
      status: true,
      fieldStatus: true,
    },
  },
} as const;

export async function createNotification(input: RecipientNotificationInput) {
  return prisma.notification.create({
    data: {
      body: input.body,
      recipientId: input.recipientId,
      reportId: input.reportId,
      title: input.title,
      type: input.type,
    },
    select: notificationSelect,
  });
}

export async function notifyAdmins(input: NotificationInput) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (!admins.length) {
    return;
  }

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      body: input.body,
      recipientId: admin.id,
      reportId: input.reportId,
      title: input.title,
      type: input.type,
    })),
  });
}

export async function notifyReporter(
  report: { id: string; reporterId: string | null },
  input: NotificationInput
) {
  if (!report.reporterId) {
    return;
  }

  await createNotification({
    ...input,
    recipientId: report.reporterId,
    reportId: input.reportId ?? report.id,
  });
}
