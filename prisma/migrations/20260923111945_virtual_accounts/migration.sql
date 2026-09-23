-- CreateTable
CREATE TABLE "VirtualAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VirtualAccountTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" INTEGER NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VirtualAccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "VirtualAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VirtualAccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "VirtualAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "categoryId" TEXT,
    "memberId" TEXT,
    "description" TEXT,
    "method" TEXT,
    "virtualAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_virtualAccountId_fkey" FOREIGN KEY ("virtualAccountId") REFERENCES "VirtualAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "categoryId", "createdAt", "date", "description", "id", "memberId", "method", "type", "updatedAt") SELECT "amount", "categoryId", "createdAt", "date", "description", "id", "memberId", "method", "type", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_name_key" ON "VirtualAccount"("name");

-- 既定の仮想口座「部」を作成し、既存の入出金をすべて割り当てる
INSERT INTO "VirtualAccount" ("id", "name", "order", "isActive", "updatedAt")
VALUES ('default-club-account', '部', 0, true, CURRENT_TIMESTAMP);
UPDATE "Transaction" SET "virtualAccountId" = 'default-club-account' WHERE "virtualAccountId" IS NULL;
