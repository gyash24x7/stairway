ALTER TABLE `clbk_declarations`
    RENAME TO `clbk_deal_scores`;

--> statement-breakpoint
PRAGMA foreign_keys= OFF;

--> statement-breakpoint
CREATE TABLE `__new_clbk_deal_scores`
(
    `id`           text              NOT NULL,
    `deal_id`      text              NOT NULL,
    `game_id`      text              NOT NULL,
    `player_id`    text              NOT NULL,
    `declarations` integer DEFAULT 2 NOT NULL,
    `wins`         integer DEFAULT 0 NOT NULL,
    PRIMARY KEY (`id`, `deal_id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `clbk_games` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`player_id`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`deal_id`, `game_id`) REFERENCES `clbk_deals` (`id`, `game_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
INSERT INTO `__new_clbk_deal_scores`("id", "deal_id", "game_id", "player_id", "declarations", "wins")
SELECT "id", "deal_id", "game_id", "player_id", "declarations", "wins"
FROM `clbk_deal_scores`;

--> statement-breakpoint
DROP TABLE `clbk_deal_scores`;

--> statement-breakpoint
ALTER TABLE `__new_clbk_deal_scores`
    RENAME TO `clbk_deal_scores`;

--> statement-breakpoint
PRAGMA foreign_keys= ON;

--> statement-breakpoint
ALTER TABLE `clbk_rounds`
    ADD `completed` integer DEFAULT 0 NOT NULL;