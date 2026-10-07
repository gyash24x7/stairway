CREATE TABLE "passkeys"
(
    "id"            uuid PRIMARY KEY DEFAULT uuidv7(),
    "name"          text,
    "public_key"    text    NOT NULL,
    "user_id"       uuid    NOT NULL,
    "credential_id" text    NOT NULL,
    "counter"       integer NOT NULL
);

--> statement-breakpoint

CREATE TABLE "users"
(
    "id"       uuid PRIMARY KEY DEFAULT uuidv7(),
    "name"     text NOT NULL,
    "username" text NOT NULL UNIQUE,
    "avatar"   text NOT NULL
);

--> statement-breakpoint

CREATE TABLE "game_commits"
(
    "id"        text PRIMARY KEY DEFAULT uuidv7(),
    "game_id"   text      NOT NULL,
    "at"        timestamp NOT NULL,
    "command"   text      NOT NULL,
    "actor"     text      NOT NULL,
    "move_type" text,
    "events"    jsonb     NOT NULL
);

--> statement-breakpoint

CREATE TABLE "game_players"
(
    "id"        text PRIMARY KEY DEFAULT uuidv7(),
    "game_id"   text                           NOT NULL,
    "player_id" text                           NOT NULL,
    "name"      text                           NOT NULL,
    "avatar"    text                           NOT NULL,
    "is_bot"    boolean          DEFAULT false NOT NULL,
    "team"      text,
    "team_name" text,
    "rank"      integer,
    "score"     double precision,
    "is_winner" boolean          DEFAULT false NOT NULL
);

--> statement-breakpoint

CREATE TABLE "games"
(
    "id"            text PRIMARY KEY DEFAULT uuidv7(),
    "game"          text                               NOT NULL,
    "status"        text             DEFAULT 'CREATED' NOT NULL,
    "config"        jsonb                              NOT NULL,
    "initial_state" jsonb                              NOT NULL,
    "rematch_of"    text,
    "completed_at"  timestamp,
    "created_at"    timestamp        DEFAULT now()     NOT NULL
);

--> statement-breakpoint

CREATE INDEX "passkey_user_id_idx" ON "passkeys" ("user_id");

--> statement-breakpoint

CREATE INDEX "passkey_credential_id_idx" ON "passkeys" ("credential_id");

--> statement-breakpoint

CREATE INDEX "game_commits_game_id_idx" ON "game_commits" ("game_id");

--> statement-breakpoint

CREATE INDEX "game_players_game_id_idx" ON "game_players" ("game_id");

--> statement-breakpoint

CREATE INDEX "game_players_player_id_idx" ON "game_players" ("player_id");

--> statement-breakpoint

CREATE INDEX "game_players_game_and_player_id_idx" ON "game_players" ("game_id", "player_id");

--> statement-breakpoint

CREATE INDEX "game_name_idx" ON "games" ("game");

--> statement-breakpoint

ALTER TABLE "passkeys"
    ADD CONSTRAINT "passkeys_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;

--> statement-breakpoint

ALTER TABLE "game_commits"
    ADD CONSTRAINT "game_commits_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id");

--> statement-breakpoint

ALTER TABLE "game_players"
    ADD CONSTRAINT "game_players_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games" ("id");

--> statement-breakpoint

ALTER TABLE "games"
    ADD CONSTRAINT "games_rematch_of_games_id_fkey" FOREIGN KEY ("rematch_of") REFERENCES "games" ("id");