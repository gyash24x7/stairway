ALTER TABLE `games` ADD `rematch_of` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_games_rematch_of` ON `games` (`rematch_of`);