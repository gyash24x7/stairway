PRAGMA foreign_keys= OFF;

--> statement-breakpoint
CREATE TABLE `__new_clbk_players`
(
    `id`       text              NOT NULL,
    `name`     text              NOT NULL,
    `username` text              NOT NULL,
    `avatar`   text              NOT NULL,
    `game_id`  text              NOT NULL,
    `is_bot`   integer DEFAULT 0 NOT NULL,
    PRIMARY KEY (`id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `clbk_games` (`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
INSERT INTO `__new_clbk_players`("id", "name", "username", "avatar", "game_id", "is_bot")
SELECT "id", "name", "username", "avatar", "game_id", "is_bot"
FROM `clbk_players`;

--> statement-breakpoint
DROP TABLE `clbk_players`;

--> statement-breakpoint
ALTER TABLE `__new_clbk_players`
    RENAME TO `clbk_players`;

--> statement-breakpoint
PRAGMA foreign_keys= ON;

--> statement-breakpoint
CREATE UNIQUE INDEX `clbk_players_username_unique` ON `clbk_players` (`username`);

--> statement-breakpoint
CREATE TABLE `__new_lit_players`
(
    `id`       text              NOT NULL,
    `name`     text              NOT NULL,
    `username` text              NOT NULL,
    `avatar`   text              NOT NULL,
    `game_id`  text              NOT NULL,
    `team_id`  text,
    `is_bot`   integer DEFAULT 0 NOT NULL,
    PRIMARY KEY (`id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `lit_games` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`team_id`) REFERENCES `lit_teams` (`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
INSERT INTO `__new_lit_players`("id", "name", "username", "avatar", "game_id", "team_id", "is_bot")
SELECT "id", "name", "username", "avatar", "game_id", "team_id", "is_bot"
FROM `lit_players`;

--> statement-breakpoint
DROP TABLE `lit_players`;

--> statement-breakpoint
ALTER TABLE `__new_lit_players`
    RENAME TO `lit_players`;

--> statement-breakpoint
CREATE UNIQUE INDEX `lit_players_username_unique` ON `lit_players` (`username`);