-- CreateTable
CREATE TABLE "health_check" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT 'prisma_connected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_check_pkey" PRIMARY KEY ("id")
);
