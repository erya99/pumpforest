-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seed" TEXT NOT NULL,
    "participants" JSONB NOT NULL,
    "winner" TEXT,
    "log" JSONB NOT NULL
);
