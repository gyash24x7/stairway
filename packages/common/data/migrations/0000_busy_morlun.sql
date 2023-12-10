CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "literature";
--> statement-breakpoint
DO
$$
    BEGIN
        CREATE TYPE "literature"."literature_game_status" AS ENUM ('CREATED', 'PLAYERS_READY', 'TEAMS_CREATED', 'IN_PROGRESS', 'COMPLETED');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        CREATE TYPE "literature"."literature_move_type" AS ENUM ('ASK_CARD', 'CALL_SET', 'TRANSFER_TURN');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."users"
(
    "id"     text PRIMARY KEY NOT NULL,
    "name"   text             NOT NULL,
    "email"  text             NOT NULL,
    "avatar" text             NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."card_mappings"
(
    "card_id"   text NOT NULL,
    "player_id" text NOT NULL,
    "game_id"   text NOT NULL,
    CONSTRAINT card_mappings_card_id_game_id_pk PRIMARY KEY ("card_id", "game_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."games"
(
    "id"           text PRIMARY KEY                                        NOT NULL,
    "code"         text                                                    NOT NULL,
    "status"       "literature"."literature_game_status" DEFAULT 'CREATED' NOT NULL,
    "player_count" smallint                              DEFAULT 6         NOT NULL,
    "current_turn" text                                                    NOT NULL,
    CONSTRAINT "games_code_unique" UNIQUE ("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."moves"
(
    "id"          text PRIMARY KEY                    NOT NULL,
    "game_id"     text                                NOT NULL,
    "move_type"   "literature"."literature_move_type" NOT NULL,
    "description" text                                NOT NULL,
    "success"     boolean                             NOT NULL,
    "data"        json                                NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."players"
(
    "id"      text NOT NULL,
    "name"    text NOT NULL,
    "avatar"  text NOT NULL,
    "game_id" text NOT NULL,
    "team_id" text,
    CONSTRAINT players_id_game_id_pk PRIMARY KEY ("id", "game_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."teams"
(
    "id"         text PRIMARY KEY   NOT NULL,
    "game_id"    text               NOT NULL,
    "name"       text               NOT NULL,
    "score"      smallint DEFAULT 0 NOT NULL,
    "sets_won"   json               NOT NULL,
    "member_ids" json               NOT NULL
);
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."card_mappings"
            ADD CONSTRAINT "card_mappings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "literature"."games" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."moves"
            ADD CONSTRAINT "moves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "literature"."games" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."players"
            ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "literature"."games" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."players"
            ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "literature"."teams" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."teams"
            ADD CONSTRAINT "teams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "literature"."games" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
