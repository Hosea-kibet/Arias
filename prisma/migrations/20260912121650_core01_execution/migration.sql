/*
  Warnings:

  - Added the required column `updatedAt` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "EventRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "result" JSONB,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventRun_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "executionId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);
INSERT INTO "new_Event" ("completedAt", "createdAt", "error", "id", "idempotencyKey", "payload", "result", "source", "startedAt", "status", "type", "updatedAt") SELECT "completedAt", "createdAt", "error", "id", "idempotencyKey", "payload", "result", "source", "startedAt", "status", "type", "createdAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_idempotencyKey_key" ON "Event"("idempotencyKey");
CREATE UNIQUE INDEX "Event_executionId_key" ON "Event"("executionId");
CREATE INDEX "Event_status_createdAt_idx" ON "Event"("status", "createdAt");
CREATE TABLE "new_ToolCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "runId" TEXT,
    "executionId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    CONSTRAINT "ToolCall_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ToolCall_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EventRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ToolCall" ("completedAt", "createdAt", "error", "eventId", "id", "input", "name", "output") SELECT "completedAt", "createdAt", "error", "eventId", "id", "input", "name", "output" FROM "ToolCall";
DROP TABLE "ToolCall";
ALTER TABLE "new_ToolCall" RENAME TO "ToolCall";
CREATE INDEX "ToolCall_eventId_idx" ON "ToolCall"("eventId");
CREATE INDEX "ToolCall_runId_idx" ON "ToolCall"("runId");
CREATE INDEX "ToolCall_executionId_idx" ON "ToolCall"("executionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EventRun_executionId_key" ON "EventRun"("executionId");

-- CreateIndex
CREATE INDEX "EventRun_eventId_createdAt_idx" ON "EventRun"("eventId", "createdAt");
