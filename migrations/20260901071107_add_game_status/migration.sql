ALTER TABLE `games` ADD `status` text DEFAULT 'CREATED' NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `status_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `seats_taken` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `player_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `games` SET `status` = CASE WHEN `completed` = 1 THEN 'COMPLETED' ELSE 'IN_PROGRESS' END;
