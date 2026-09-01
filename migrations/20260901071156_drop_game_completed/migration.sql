DROP INDEX `idx_games_sweep`;--> statement-breakpoint
ALTER TABLE `games` DROP COLUMN `completed`;--> statement-breakpoint
CREATE INDEX `idx_games_sweep` ON `games` (`status`,`cleaned_up`);--> statement-breakpoint
CREATE INDEX `idx_games_open` ON `games` (`status`,`game`,`created_at`);
