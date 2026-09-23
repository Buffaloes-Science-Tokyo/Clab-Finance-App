-- CreateTable
CREATE TABLE "SyncOutbox" (
    "seq" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "model" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "changedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "deviceId" TEXT NOT NULL,
    "lastPulledSeq" INTEGER NOT NULL DEFAULT 0,
    "initialized" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" DATETIME,
    "lastResult" TEXT
);

-- CreateIndex
CREATE INDEX "SyncOutbox_model_rowId_idx" ON "SyncOutbox"("model", "rowId");

