-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolCall" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ToolCall_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_idempotencyKey_key" ON "Event"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Event_status_createdAt_idx" ON "Event"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ToolCall_eventId_idx" ON "ToolCall"("eventId");
