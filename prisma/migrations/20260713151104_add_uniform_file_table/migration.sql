-- CreateTable
CREATE TABLE "UniformFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gangName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "approver" TEXT NOT NULL,
    "approverDiscord" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);
