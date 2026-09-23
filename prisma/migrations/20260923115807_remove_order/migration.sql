-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Category" ("id", "isActive", "name", "type") SELECT "id", "isActive", "name", "type" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE TABLE "new_DuesItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DuesItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DuesItem" ("amount", "categoryId", "createdAt", "id", "isActive", "name", "updatedAt") SELECT "amount", "categoryId", "createdAt", "id", "isActive", "name", "updatedAt" FROM "DuesItem";
DROP TABLE "DuesItem";
ALTER TABLE "new_DuesItem" RENAME TO "DuesItem";
CREATE TABLE "new_VirtualAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VirtualAccount" ("createdAt", "id", "isActive", "name", "note", "updatedAt") SELECT "createdAt", "id", "isActive", "name", "note", "updatedAt" FROM "VirtualAccount";
DROP TABLE "VirtualAccount";
ALTER TABLE "new_VirtualAccount" RENAME TO "VirtualAccount";
CREATE UNIQUE INDEX "VirtualAccount_name_key" ON "VirtualAccount"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

