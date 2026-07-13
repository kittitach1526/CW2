-- CreateTable
CREATE TABLE "Council" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "colorTheme" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "coLeader1" TEXT,
    "coLeader2" TEXT,
    "approver" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Council_abbreviation_key" ON "Council"("abbreviation");
