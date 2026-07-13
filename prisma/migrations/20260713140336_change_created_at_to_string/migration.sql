-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Gang" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "colorTheme" TEXT NOT NULL DEFAULT '#3b82f6',
    "leader" TEXT NOT NULL,
    "coLeader1" TEXT,
    "coLeader2" TEXT,
    "approver" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL
);
INSERT INTO "new_Gang" ("abbreviation", "approver", "coLeader1", "coLeader2", "colorTheme", "createdAt", "fullName", "id", "leader", "password", "status") SELECT "abbreviation", "approver", "coLeader1", "coLeader2", "colorTheme", "createdAt", "fullName", "id", "leader", "password", "status" FROM "Gang";
DROP TABLE "Gang";
ALTER TABLE "new_Gang" RENAME TO "Gang";
CREATE UNIQUE INDEX "Gang_abbreviation_key" ON "Gang"("abbreviation");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
