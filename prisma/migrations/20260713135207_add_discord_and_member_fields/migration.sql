/*
  Warnings:

  - You are about to drop the `Council` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Council";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Gang" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "colorTheme" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "coLeader1" TEXT,
    "coLeader2" TEXT,
    "approver" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Gang_abbreviation_key" ON "Gang"("abbreviation");
