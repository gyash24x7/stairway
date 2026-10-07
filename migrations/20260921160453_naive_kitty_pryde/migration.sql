CREATE TABLE "game_spectators"
(
    "id"        text PRIMARY KEY DEFAULT uuidv7(),
    "game_id"   text                           NOT NULL,
    "player_id" text                           NOT NULL,
    "name"      text                           NOT NULL,
    "avatar"    text                           NOT NULL,
    "joined_at" timestamp        DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE INDEX "game_spectators_game_id_idx" ON "game_spectators" ("game_id");

--> statement-breakpoint

CREATE INDEX "game_spectators_player_id_idx" ON "game_spectators" ("player_id");

--> statement-breakpoint

CREATE INDEX "game_spectators_game_and_player_id_idx" ON "game_spectators" ("game_id", "player_id");

--> statement-breakpoint

ALTER TABLE "game_spectators"
    ADD CONSTRAINT "game_spectators_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id");