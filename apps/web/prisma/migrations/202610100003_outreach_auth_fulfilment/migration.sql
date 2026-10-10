-- AlterTable
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotConversation" (
    "phone" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "pendingLat" REAL,
    "pendingLng" REAL,
    "pendingAreaLabel" TEXT,
    "pendingSource" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutreachWave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "waveNumber" INTEGER NOT NULL,
    "radiusKm" REAL NOT NULL,
    "size" INTEGER NOT NULL,
    "startedById" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "OutreachWave_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BloodRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutreachInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waveId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "distanceKm" REAL NOT NULL,
    "reasons" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "respondedAt" DATETIME,
    "arrivedAt" DATETIME,
    "donatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutreachInvite_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "OutreachWave" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutreachInvite_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BloodRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutreachInvite_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "toPhone" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "requestId" TEXT,
    "inviteId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FulfilmentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FulfilmentRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BloodRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecognitionAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecognitionAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecognitionAward_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "OutreachInvite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "notificationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BloodRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "bloodGroup" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "neededBy" DATETIME NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "verification" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "outcome" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BloodRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BloodRequest_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BloodRequest" ("bloodGroup", "component", "createdAt", "hospitalId", "id", "idempotencyKey", "isSimulated", "language", "neededBy", "outcome", "payloadHash", "requesterId", "status", "units", "updatedAt", "verification") SELECT "bloodGroup", "component", "createdAt", "hospitalId", "id", "idempotencyKey", "isSimulated", "language", "neededBy", "outcome", "payloadHash", "requesterId", "status", "units", "updatedAt", "verification" FROM "BloodRequest";
DROP TABLE "BloodRequest";
ALTER TABLE "new_BloodRequest" RENAME TO "BloodRequest";
CREATE INDEX "BloodRequest_hospitalId_status_createdAt_idx" ON "BloodRequest"("hospitalId", "status", "createdAt");
CREATE UNIQUE INDEX "BloodRequest_requesterId_idempotencyKey_key" ON "BloodRequest"("requesterId", "idempotencyKey");
CREATE TABLE "new_RequestEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STATUS_CHANGED',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BloodRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RequestEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RequestEvent" ("actorId", "createdAt", "fromStatus", "id", "requestId", "toStatus") SELECT "actorId", "createdAt", "fromStatus", "id", "requestId", "toStatus" FROM "RequestEvent";
DROP TABLE "RequestEvent";
ALTER TABLE "new_RequestEvent" RENAME TO "RequestEvent";
CREATE INDEX "RequestEvent_requestId_createdAt_idx" ON "RequestEvent"("requestId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_subject_key" ON "OAuthAccount"("provider", "subject");

-- CreateIndex
CREATE INDEX "OutreachWave_closedAt_closesAt_idx" ON "OutreachWave"("closedAt", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachWave_requestId_waveNumber_key" ON "OutreachWave"("requestId", "waveNumber");

-- CreateIndex
CREATE INDEX "OutreachInvite_donorId_status_idx" ON "OutreachInvite"("donorId", "status");

-- CreateIndex
CREATE INDEX "OutreachInvite_requestId_status_idx" ON "OutreachInvite"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachInvite_requestId_donorId_key" ON "OutreachInvite"("requestId", "donorId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_toPhone_createdAt_idx" ON "Notification"("toPhone", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_inviteId_idx" ON "Notification"("inviteId");

-- CreateIndex
CREATE INDEX "FulfilmentRecord_requestId_idx" ON "FulfilmentRecord"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RecognitionAward_code_key" ON "RecognitionAward"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RecognitionAward_inviteId_key" ON "RecognitionAward"("inviteId");

-- CreateIndex
CREATE INDEX "RecognitionAward_userId_idx" ON "RecognitionAward"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_userId_dueAt_key" ON "ReminderLog"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
