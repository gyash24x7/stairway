CREATE TABLE `game_results` (
	`game_id` text NOT NULL,
	`game` text NOT NULL,
	`player_id` text NOT NULL,
	`rank` integer NOT NULL,
	`score` real,
	`team` text,
	`winner` integer DEFAULT false NOT NULL,
	`completed_at` integer NOT NULL,
	CONSTRAINT `game_results_pk` PRIMARY KEY(`game_id`, `player_id`),
	CONSTRAINT `fk_game_results_game_id_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_game_results_player_id` ON `game_results` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_game_results_game` ON `game_results` (`game`);