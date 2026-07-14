-- CreateTable
CREATE TABLE "DisbandRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gangId" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL,
    "reviewedAt" TEXT,
    "reviewer" TEXT,
    CONSTRAINT "DisbandRequest_gangId_fkey" FOREIGN KEY ("gangId") REFERENCES "Gang" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DisbandRequest_gangId_key" ON "DisbandRequest"("gangId");
