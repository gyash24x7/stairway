CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "literature";
--> statement-breakpoint
CREATE SCHEMA "wordle";
--> statement-breakpoint
DO
$$
    BEGIN
        CREATE TYPE "literature_game_status" AS ENUM ('CREATED', 'PLAYERS_READY', 'TEAMS_CREATED', 'IN_PROGRESS', 'COMPLETED');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        CREATE TYPE "literature_move_type" AS ENUM ('ASK_CARD', 'CALL_SET', 'TRANSFER_TURN');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."users"
(
    "id"     text NOT NULL,
    "name"   text NOT NULL,
    "avatar" text NOT NULL,
    "email"  text NOT NULL,
    CONSTRAINT "users_email_unique" UNIQUE ("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."literature_card_locations"
(
    "game_id"    text    NOT NULL,
    "player_id"  text    NOT NULL,
    "card_id"    text    NOT NULL,
    "player_ids" json    NOT NULL,
    "weight"     integer NOT NULL,
    CONSTRAINT "literature_card_locations_game_id_player_id_card_id_pk" PRIMARY KEY ("game_id", "player_id", "card_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."literature_card_mappings"
(
    "card_id"   text NOT NULL,
    "player_id" text NOT NULL,
    "game_id"   text NOT NULL,
    CONSTRAINT "literature_card_mappings_card_id_game_id_pk" PRIMARY KEY ("card_id", "game_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."literature_games"
(
    "id"           text PRIMARY KEY                           NOT NULL,
    "code"         text                                       NOT NULL,
    "status"       "literature_game_status" DEFAULT 'CREATED' NOT NULL,
    "player_count" smallint                 DEFAULT 6         NOT NULL,
    "current_turn" text                                       NOT NULL,
    CONSTRAINT "literature_games_code_unique" UNIQUE ("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."literature_moves"
(
    "id"          text PRIMARY KEY       NOT NULL,
    "game_id"     text                   NOT NULL,
    "player_id"   text                   NOT NULL,
    "timestamp"   text                   NOT NULL,
    "move_type"   "literature_move_type" NOT NULL,
    "description" text                   NOT NULL,
    "success"     boolean                NOT NULL,
    "data"        json                   NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."literature_players"
(
    "id"      text                  NOT NULL,
    "name"    text                  NOT NULL,
    "avatar"  text                  NOT NULL,
    "game_id" text                  NOT NULL,
    "team_id" text,
    "is_bot"  boolean DEFAULT false NOT NULL,
    CONSTRAINT "literature_players_id_game_id_pk" PRIMARY KEY ("id", "game_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "literature"."literature_teams"
(
    "id"         text PRIMARY KEY   NOT NULL,
    "game_id"    text               NOT NULL,
    "name"       text               NOT NULL,
    "score"      smallint DEFAULT 0 NOT NULL,
    "sets_won"   json               NOT NULL,
    "member_ids" json               NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wordle"."wordle_games"
(
    "id"              text PRIMARY KEY            NOT NULL,
    "player_id"       text                        NOT NULL,
    "word_length"     smallint DEFAULT 5          NOT NULL,
    "word_count"      smallint DEFAULT 1          NOT NULL,
    "words"           json                        NOT NULL,
    "guesses"         json     DEFAULT '[]'::json NOT NULL,
    "completed_words" json     DEFAULT '[]'::json NOT NULL
);
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."literature_card_mappings"
            ADD CONSTRAINT "literature_card_mappings_game_id_literature_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "literature"."literature_games" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."literature_moves"
            ADD CONSTRAINT "literature_moves_game_id_literature_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "literature"."literature_games" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."literature_players"
            ADD CONSTRAINT "literature_players_game_id_literature_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "literature"."literature_games" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."literature_players"
            ADD CONSTRAINT "literature_players_team_id_literature_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "literature"."literature_teams" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
--> statement-breakpoint
DO
$$
    BEGIN
        ALTER TABLE "literature"."literature_teams"
            ADD CONSTRAINT "literature_teams_game_id_literature_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "literature"."literature_games" ("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
