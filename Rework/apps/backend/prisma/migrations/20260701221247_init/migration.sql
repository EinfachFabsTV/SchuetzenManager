-- CreateTable
CREATE TABLE "Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "infoBox" TEXT,
    "contactMail" TEXT,
    "contactPerson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "trainingDay" TEXT,
    "trainingTime" TEXT,
    "location" TEXT,
    "contact" TEXT,
    "phone" TEXT,
    "seasonId" INTEGER NOT NULL,
    CONSTRAINT "Team_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "week" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "guestTeamId" INTEGER NOT NULL,
    CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_guestTeamId_fkey" FOREIGN KEY ("guestTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchDate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "week" INTEGER NOT NULL,
    "date" TEXT,
    "seasonId" INTEGER NOT NULL,
    CONSTRAINT "MatchDate_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shoot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "teamSide" TEXT NOT NULL,
    "additional" BOOLEAN NOT NULL DEFAULT false,
    "startId" INTEGER,
    "endId" INTEGER,
    "result" REAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    CONSTRAINT "Shoot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "salt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Responsible" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "team" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    CONSTRAINT "Responsible_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_seasonId_name_key" ON "Team"("seasonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Match_seasonId_homeTeamId_guestTeamId_key" ON "Match"("seasonId", "homeTeamId", "guestTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchDate_seasonId_week_key" ON "MatchDate"("seasonId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
