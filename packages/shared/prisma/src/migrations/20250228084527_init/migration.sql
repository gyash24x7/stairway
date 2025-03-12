-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "callbreak";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "literature";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "wordle";

-- CreateEnum
CREATE TYPE "callbreak"."CallBreakStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "literature"."LiteratureGameStatus" AS ENUM ('CREATED', 'PLAYERS_READY', 'TEAMS_CREATED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "auth"."auth_users"
(
    "id"            TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "email"         TEXT         NOT NULL,
    "emailVerified" BOOLEAN      NOT NULL DEFAULT false,
    "image"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."auth_sessions"
(
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT         NOT NULL,
    "userAgent" TEXT         NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."auth_accounts"
(
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "providerId"   TEXT NOT NULL,
    "accountId"    TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessToken"  TEXT,
    "expiresAt"    TIMESTAMP(3),
    "password"     TEXT,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."auth_verifications"
(
    "id"         TEXT         NOT NULL,
    "identifier" TEXT         NOT NULL,
    "value"      TEXT         NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "callbreak"."clbk_games"
(
    "id"        TEXT                          NOT NULL,
    "code"      TEXT                          NOT NULL,
    "dealCount" INTEGER                       NOT NULL DEFAULT 5,
    "trumpSuit" TEXT                          NOT NULL,
    "status"    "callbreak"."CallBreakStatus" NOT NULL DEFAULT 'CREATED',
    "createdBy" TEXT                          NOT NULL,
    "scores"    JSONB                         NOT NULL DEFAULT '[]',

    CONSTRAINT "clbk_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "callbreak"."clbk_players"
(
    "id"     TEXT    NOT NULL,
    "name"   TEXT    NOT NULL,
    "avatar" TEXT    NOT NULL,
    "gameId" TEXT    NOT NULL,
    "isBot"  BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clbk_players_pkey" PRIMARY KEY ("id", "gameId")
);

-- CreateTable
CREATE TABLE "callbreak"."clbk_deals"
(
    "id"           TEXT                          NOT NULL,
    "gameId"       TEXT                          NOT NULL,
    "playerOrder"  TEXT[],
    "declarations" JSONB                         NOT NULL DEFAULT '{}',
    "wins"         JSONB                         NOT NULL DEFAULT '{}',
    "turnIdx"      INTEGER                       NOT NULL DEFAULT 0,
    "status"       "callbreak"."CallBreakStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt"    TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clbk_deals_pkey" PRIMARY KEY ("id", "gameId")
);

-- CreateTable
CREATE TABLE "callbreak"."clbk_card_mappings"
(
    "cardId"   TEXT NOT NULL,
    "dealId"   TEXT NOT NULL,
    "gameId"   TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "clbk_card_mappings_pkey" PRIMARY KEY ("cardId", "dealId", "gameId")
);

-- CreateTable
CREATE TABLE "callbreak"."clbk_rounds"
(
    "id"          TEXT         NOT NULL,
    "gameId"      TEXT         NOT NULL,
    "dealId"      TEXT         NOT NULL,
    "winner"      TEXT,
    "playerOrder" TEXT[],
    "cards"       JSONB        NOT NULL DEFAULT '{}',
    "turnIdx"     INTEGER      NOT NULL DEFAULT 0,
    "suit"        TEXT,
    "completed"   BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clbk_rounds_pkey" PRIMARY KEY ("id", "dealId", "gameId")
);

-- CreateTable
CREATE TABLE "literature"."lit_players"
(
    "id"     TEXT    NOT NULL,
    "name"   TEXT    NOT NULL,
    "avatar" TEXT    NOT NULL,
    "gameId" TEXT    NOT NULL,
    "teamId" TEXT,
    "isBot"  BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lit_players_pkey" PRIMARY KEY ("id", "gameId")
);

-- CreateTable
CREATE TABLE "literature"."lit_teams"
(
    "id"        TEXT    NOT NULL,
    "name"      TEXT    NOT NULL,
    "score"     INTEGER NOT NULL DEFAULT 0,
    "setsWon"   TEXT[]           DEFAULT ARRAY []::TEXT[],
    "memberIds" TEXT[],
    "gameId"    TEXT    NOT NULL,

    CONSTRAINT "lit_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "literature"."lit_card_mappings"
(
    "cardId"   TEXT NOT NULL,
    "gameId"   TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "lit_card_mappings_pkey" PRIMARY KEY ("gameId", "cardId")
);

-- CreateTable
CREATE TABLE "literature"."lit_card_locations"
(
    "cardId"    TEXT    NOT NULL,
    "gameId"    TEXT    NOT NULL,
    "playerId"  TEXT    NOT NULL,
    "playerIds" TEXT[],
    "weight"    INTEGER NOT NULL,

    CONSTRAINT "lit_card_locations_pkey" PRIMARY KEY ("gameId", "playerId", "cardId")
);

-- CreateTable
CREATE TABLE "literature"."lit_asks"
(
    "id"          TEXT         NOT NULL,
    "gameId"      TEXT         NOT NULL,
    "playerId"    TEXT         NOT NULL,
    "timestamp"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT         NOT NULL,
    "success"     BOOLEAN      NOT NULL,
    "cardId"      TEXT         NOT NULL,
    "askedFrom"   TEXT         NOT NULL,

    CONSTRAINT "lit_asks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "literature"."lit_calls"
(
    "id"          TEXT         NOT NULL,
    "gameId"      TEXT         NOT NULL,
    "playerId"    TEXT         NOT NULL,
    "timestamp"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT         NOT NULL,
    "success"     BOOLEAN      NOT NULL,
    "cardSet"     TEXT         NOT NULL,
    "actualCall"  JSONB        NOT NULL,
    "correctCall" JSONB        NOT NULL,

    CONSTRAINT "lit_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "literature"."lit_transfers"
(
    "id"          TEXT         NOT NULL,
    "gameId"      TEXT         NOT NULL,
    "playerId"    TEXT         NOT NULL,
    "timestamp"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT         NOT NULL,
    "success"     BOOLEAN      NOT NULL DEFAULT true,
    "transferTo"  TEXT         NOT NULL,

    CONSTRAINT "lit_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "literature"."lit_games"
(
    "id"          TEXT                                NOT NULL,
    "code"        TEXT                                NOT NULL,
    "status"      "literature"."LiteratureGameStatus" NOT NULL DEFAULT 'CREATED',
    "playerCount" INTEGER                             NOT NULL DEFAULT 6,
    "currentTurn" TEXT                                NOT NULL,
    "lastMoveId"  TEXT                                NOT NULL DEFAULT '',

    CONSTRAINT "lit_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordle"."wdl_games"
(
    "id"             TEXT    NOT NULL,
    "playerId"       TEXT    NOT NULL,
    "wordLength"     INTEGER NOT NULL DEFAULT 5,
    "wordCount"      INTEGER NOT NULL DEFAULT 1,
    "words"          TEXT[],
    "guesses"        TEXT[],
    "completedWords" TEXT[],

    CONSTRAINT "wdl_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth"."auth_users" ("email");

-- CreateIndex
CREATE UNIQUE INDEX "clbk_games_code_key" ON "callbreak"."clbk_games" ("code");

-- CreateIndex
CREATE UNIQUE INDEX "lit_games_code_key" ON "literature"."lit_games" ("code");

-- AddForeignKey
ALTER TABLE "auth"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."auth_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."auth_accounts"
    ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."auth_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callbreak"."clbk_players"
    ADD CONSTRAINT "clbk_players_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "callbreak"."clbk_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callbreak"."clbk_deals"
    ADD CONSTRAINT "clbk_deals_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "callbreak"."clbk_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callbreak"."clbk_card_mappings"
    ADD CONSTRAINT "clbk_card_mappings_dealId_gameId_fkey" FOREIGN KEY ("dealId", "gameId") REFERENCES "callbreak"."clbk_deals" ("id", "gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callbreak"."clbk_card_mappings"
    ADD CONSTRAINT "clbk_card_mappings_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "callbreak"."clbk_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callbreak"."clbk_card_mappings"
    ADD CONSTRAINT "clbk_card_mappings_playerId_gameId_fkey" FOREIGN KEY ("playerId", "gameId") REFERENCES "callbreak"."clbk_players" ("id", "gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callbreak"."clbk_rounds"
    ADD CONSTRAINT "clbk_rounds_dealId_gameId_fkey" FOREIGN KEY ("dealId", "gameId") REFERENCES "callbreak"."clbk_deals" ("id", "gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callbreak"."clbk_rounds"
    ADD CONSTRAINT "clbk_rounds_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "callbreak"."clbk_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_players"
    ADD CONSTRAINT "lit_players_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "literature"."lit_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_players"
    ADD CONSTRAINT "lit_players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "literature"."lit_teams" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_teams"
    ADD CONSTRAINT "lit_teams_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "literature"."lit_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_card_mappings"
    ADD CONSTRAINT "lit_card_mappings_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "literature"."lit_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_card_mappings"
    ADD CONSTRAINT "lit_card_mappings_playerId_gameId_fkey" FOREIGN KEY ("playerId", "gameId") REFERENCES "literature"."lit_players" ("id", "gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_card_locations"
    ADD CONSTRAINT "lit_card_locations_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "literature"."lit_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_card_locations"
    ADD CONSTRAINT "lit_card_locations_playerId_gameId_fkey" FOREIGN KEY ("playerId", "gameId") REFERENCES "literature"."lit_players" ("id", "gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_asks"
    ADD CONSTRAINT "lit_asks_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "literature"."lit_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_asks"
    ADD CONSTRAINT "lit_asks_playerId_gameId_fkey" FOREIGN KEY ("playerId", "gameId") REFERENCES "literature"."lit_players" ("id", "gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_calls"
    ADD CONSTRAINT "lit_calls_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "literature"."lit_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_calls"
    ADD CONSTRAINT "lit_calls_playerId_gameId_fkey" FOREIGN KEY ("playerId", "gameId") REFERENCES "literature"."lit_players" ("id", "gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_transfers"
    ADD CONSTRAINT "lit_transfers_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "literature"."lit_games" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "literature"."lit_transfers"
    ADD CONSTRAINT "lit_transfers_playerId_gameId_fkey" FOREIGN KEY ("playerId", "gameId") REFERENCES "literature"."lit_players" ("id", "gameId") ON DELETE RESTRICT ON UPDATE CASCADE;
