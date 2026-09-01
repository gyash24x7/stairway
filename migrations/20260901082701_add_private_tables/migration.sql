ALTER TABLE `games`
    ADD `is_private` integer DEFAULT false NOT NULL;

--> statement-breakpoint

DROP INDEX `idx_games_open`;

--> statement-breakpoint

CREATE INDEX `idx_games_open` ON `games` (`status`, `is_private`, `game`, `created_at`);
