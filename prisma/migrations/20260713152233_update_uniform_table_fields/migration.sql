/*
  Warnings:

  - Added the required column `uniformType` to the `UniformFile` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UniformFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gangName" TEXT NOT NULL,
    "uniformType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "approver" TEXT NOT NULL,
    "approverDiscord" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'รอลง',
    "createdAt" TEXT NOT NULL
);
INSERT INTO "new_UniformFile" ("approver", "approverDiscord", "createdAt", "fileUrl", "gangName", "id") SELECT "approver", "approverDiscord", "createdAt", "fileUrl", "gangName", "id" FROM "UniformFile";
DROP TABLE "UniformFile";
ALTER TABLE "new_UniformFile" RENAME TO "UniformFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
