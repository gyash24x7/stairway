CREATE TABLE `match_players`
(
    `matchId`  text              NOT NULL,
    `playerId` text              NOT NULL,
    `name`     text              NOT NULL,
    `avatar`   text              NOT NULL,
    `isBot`    integer DEFAULT 0 NOT NULL,
    PRIMARY KEY (`matchId`, `playerId`),
    FOREIGN KEY (`matchId`) REFERENCES `matches` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`playerId`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX `idx_match_players_playerId` ON `match_players` (`playerId`);--> statement-breakpoint
CREATE INDEX `idx_match_players_matchId` ON `match_players` (`matchId`);--> statement-breakpoint
CREATE TABLE `matches`
(
    `id`        text PRIMARY KEY       NOT NULL,
    `code`      text                   NOT NULL,
    `game`      text                   NOT NULL,
    `config`    text                   NOT NULL,
    `status`    text DEFAULT 'CREATED' NOT NULL,
    `state`     text                   NOT NULL,
    `result`    text,
    `createdAt` text                   NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `matches_code_unique` ON `matches` (`code`);--> statement-breakpoint
CREATE INDEX `idx_matches_code` ON `matches` (`code`);