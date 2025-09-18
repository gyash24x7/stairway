-- CreateTable
CREATE TABLE "User"
(
    "id"       TEXT NOT NULL PRIMARY KEY,
    "name"     TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar"   TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Passkey"
(
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "publicKey" BLOB     NOT NULL,
    "counter"   INTEGER  NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"    TEXT     NOT NULL,
    CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User" ("username");

