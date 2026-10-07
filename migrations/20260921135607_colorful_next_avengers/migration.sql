ALTER TABLE "games"
    ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "games_open_idx" ON "games" ("game", "status", "created_at");