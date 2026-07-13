-- CreateTable
CREATE TABLE "WelfareRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gangName" TEXT NOT NULL,
    "gangAbbreviation" TEXT NOT NULL,
    "requestName" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "welfareItem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'รอรับ',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
