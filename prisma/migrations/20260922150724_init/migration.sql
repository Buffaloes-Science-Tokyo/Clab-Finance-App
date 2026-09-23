-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PLAYER',
    "note" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MemberLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "duesRecordId" TEXT,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberLedgerEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberLedgerEntry_duesRecordId_fkey" FOREIGN KEY ("duesRecordId") REFERENCES "MemberDuesRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemberLedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "categoryId" TEXT,
    "memberId" TEXT,
    "description" TEXT,
    "method" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "transactionId" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Receipt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Receipt_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "MemberLedgerEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuesItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DuesItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberDuesRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberDuesRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuesRecordItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "duesRecordId" TEXT NOT NULL,
    "duesItemId" TEXT,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "DuesRecordItem_duesRecordId_fkey" FOREIGN KEY ("duesRecordId") REFERENCES "MemberDuesRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DuesRecordItem_duesItemId_fkey" FOREIGN KEY ("duesItemId") REFERENCES "DuesItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "plannedAmount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClubSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "poolFundTarget" INTEGER NOT NULL DEFAULT 0,
    "roundTo" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MemberDuesRecord_memberId_yearMonth_key" ON "MemberDuesRecord"("memberId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_periodType_period_categoryId_key" ON "Budget"("periodType", "period", "categoryId");
