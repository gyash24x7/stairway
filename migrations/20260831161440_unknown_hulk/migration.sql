ALTER TABLE `games`
    ADD `cleaned_up` integer DEFAULT false NOT NULL;

--> statement-breakpoint

CREATE INDEX `idx_games_sweep` ON `games` (`completed`, `cleaned_up`);