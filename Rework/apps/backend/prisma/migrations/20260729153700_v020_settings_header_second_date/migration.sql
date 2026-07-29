-- AlterTable
ALTER TABLE "MatchDate" ADD COLUMN "dateGuest" TEXT;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN "headerLine1" TEXT;
ALTER TABLE "Season" ADD COLUMN "headerLine2" TEXT;
ALTER TABLE "Season" ADD COLUMN "logo" BLOB;

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "headerLine1" TEXT,
    "headerLine2" TEXT,
    "logo" BLOB
);
