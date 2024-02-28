ALTER TABLE "wordle"."wordle_games"
    ALTER COLUMN "guesses" SET DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "wordle"."wordle_games"
    ADD COLUMN "completed_words" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "wordle"."wordle_games"
    DROP COLUMN IF EXISTS "status";