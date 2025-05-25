CREATE TABLE `wdl_games` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`word_length` integer DEFAULT 5 NOT NULL,
	`word_count` integer DEFAULT 1 NOT NULL,
	`words` text DEFAULT '' NOT NULL,
	`guesses` text DEFAULT '' NOT NULL,
	`completed_words` text DEFAULT '' NOT NULL
);
