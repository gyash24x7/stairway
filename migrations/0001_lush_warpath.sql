CREATE TABLE `games`
(
    `id`        text PRIMARY KEY  NOT NULL,
    `code`      text              NOT NULL,
    `game`      text              NOT NULL,
    `completed` integer DEFAULT 0 NOT NULL,
    `createdAt` text              NOT NULL
);

--> statement-breakpoint

CREATE UNIQUE INDEX `games_code_unique` ON `games` (`code`);

--> statement-breakpoint

CREATE INDEX `idx_games_code` ON `games` (`code`);