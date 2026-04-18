"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markAllNotificationsRead() {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  revalidatePath("/[locale]/dashboard/notifications");
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  await prisma.notification.update({
    where: {
      id: notificationId,
      userId: session.user.id, // Ensure user owns this notification
    },
    data: {
      isRead: true,
    },
  });

  revalidatePath("/[locale]/dashboard/notifications");
}