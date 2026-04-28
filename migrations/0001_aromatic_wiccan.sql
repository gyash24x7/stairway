PRAGMA foreign_keys= OFF;

--> statement-breakpoint

CREATE TABLE `__new_games`
(
    `id`        text PRIMARY KEY  NOT NULL,
    `code`      text              NOT NULL,
    `game`      text              NOT NULL,
    `completed` integer DEFAULT 0 NOT NULL,
    `createdAt` integer           NOT NULL
);

--> statement-breakpoint

INSERT INTO `__new_games`("id", "code", "game", "completed", "createdAt")
SELECT "id", "code", "game", "completed", "createdAt"
FROM `games`;

--> statement-breakpoint

DROP TABLE `games`;

--> statement-breakpoint

ALTER TABLE `__new_games`
    RENAME TO `games`;

--> statement-breakpoint

PRAGMA foreign_keys= ON;

--> statement-breakpoint

CREATE UNIQUE INDEX `games_code_unique` ON `games` (`code`);

--> statement-breakpoint

CREATE INDEX `idx_games_code` ON `games` (`code`);