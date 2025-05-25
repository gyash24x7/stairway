CREATE TABLE `clbk_card_mappings`
(
    `card_id`   text NOT NULL,
    `deal_id`   text NOT NULL,
    `game_id`   text NOT NULL,
    `player_id` text NOT NULL,
    PRIMARY KEY (`card_id`, `deal_id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `clbk_games` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`player_id`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`deal_id`, `game_id`) REFERENCES `clbk_deals` (`id`, `game_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `clbk_card_plays`
(
    `id`        text NOT NULL,
    `round_id`  text NOT NULL,
    `deal_id`   text NOT NULL,
    `game_id`   text NOT NULL,
    `player_id` text NOT NULL,
    `card_id`   text NOT NULL,
    PRIMARY KEY (`id`, `deal_id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `clbk_games` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`player_id`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`round_id`, `deal_id`, `game_id`) REFERENCES `clbk_rounds` (`id`, `deal_id`, `game_id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`deal_id`, `game_id`) REFERENCES `clbk_deals` (`id`, `game_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clbk_deals`
(
    `id`           text                      NOT NULL,
    `game_id`      text                      NOT NULL,
    `player_order` text                      NOT NULL,
    `status`       text    DEFAULT 'CREATED' NOT NULL,
    `turn_idx`     integer DEFAULT 0         NOT NULL,
    `created_at`   text                      NOT NULL,
    PRIMARY KEY (`id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `clbk_games` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clbk_declarations`
(
    `id`        text              NOT NULL,
    `deal_id`   text              NOT NULL,
    `game_id`   text              NOT NULL,
    `player_id` text              NOT NULL,
    `wins`      integer DEFAULT 2 NOT NULL,
    PRIMARY KEY (`id`, `deal_id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `clbk_games` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`player_id`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`deal_id`, `game_id`) REFERENCES `clbk_deals` (`id`, `game_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clbk_games`
(
    `id`         text PRIMARY KEY          NOT NULL,
    `code`       text                      NOT NULL,
    `deal_count` integer DEFAULT 5         NOT NULL,
    `trump_suit` text                      NOT NULL,
    `status`     text    DEFAULT 'CREATED' NOT NULL,
    `created_by` text                      NOT NULL,
    FOREIGN KEY (`created_by`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clbk_games_code_unique` ON `clbk_games` (`code`);--> statement-breakpoint
CREATE TABLE `clbk_players`
(
    `user_id` text NOT NULL,
    `game_id` text NOT NULL,
    PRIMARY KEY (`user_id`, `game_id`),
    FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`game_id`) REFERENCES `clbk_games` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clbk_rounds`
(
    `id`           text              NOT NULL,
    `deal_id`      text              NOT NULL,
    `game_id`      text              NOT NULL,
    `winner`       text,
    `suit`         text,
    `player_order` text              NOT NULL,
    `turn_idx`     integer DEFAULT 0 NOT NULL,
    `created_at`   text              NOT NULL,
    PRIMARY KEY (`id`, `deal_id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `clbk_games` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`winner`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`deal_id`, `game_id`) REFERENCES `clbk_deals` (`id`, `game_id`) ON UPDATE no action ON DELETE no action
);
