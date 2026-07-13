-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'รอรับ',
    "createdAt" TEXT NOT NULL
);
INSERT INTO "new_admin" ("createdAt", "id", "name", "password", "status", "username") SELECT "createdAt", "id", "name", "password", "status", "username" FROM "admin";
DROP TABLE "admin";
ALTER TABLE "new_admin" RENAME TO "admin";
CREATE TABLE "new_council" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'รอรับ',
    "createdAt" TEXT NOT NULL
);
INSERT INTO "new_council" ("createdAt", "id", "name", "password", "status", "username") SELECT "createdAt", "id", "name", "password", "status", "username" FROM "council";
DROP TABLE "council";
ALTER TABLE "new_council" RENAME TO "council";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
