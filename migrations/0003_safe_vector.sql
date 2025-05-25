CREATE TABLE `lit_asks`
(
    `id`          text PRIMARY KEY  NOT NULL,
    `game_id`     text              NOT NULL,
    `player_id`   text              NOT NULL,
    `timestamp`   text              NOT NULL,
    `description` text              NOT NULL,
    `success`     integer DEFAULT 0 NOT NULL,
    `card_id`     text              NOT NULL,
    `asked_from`  text              NOT NULL,
    FOREIGN KEY (`game_id`) REFERENCES `lit_games` (`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `lit_calls`
(
    `id`           text PRIMARY KEY  NOT NULL,
    `game_id`      text              NOT NULL,
    `player_id`    text              NOT NULL,
    `timestamp`    text              NOT NULL,
    `description`  text              NOT NULL,
    `success`      integer DEFAULT 0 NOT NULL,
    `card_set`     text              NOT NULL,
    `actual_call`  text              NOT NULL,
    `correct_call` text              NOT NULL,
    FOREIGN KEY (`game_id`) REFERENCES `lit_games` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lit_card_locations`
(
    `game_id`    text    NOT NULL,
    `player_id`  text    NOT NULL,
    `card_id`    text    NOT NULL,
    `player_ids` text    NOT NULL,
    `weight`     integer NOT NULL,
    PRIMARY KEY (`game_id`, `player_id`, `card_id`),
    FOREIGN KEY (`game_id`) REFERENCES `lit_games` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lit_card_mappings`
(
    `card_id`   text NOT NULL,
    `player_id` text NOT NULL,
    `game_id`   text NOT NULL,
    PRIMARY KEY (`card_id`, `game_id`),
    FOREIGN KEY (`game_id`) REFERENCES `lit_games` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lit_games`
(
    `id`           text PRIMARY KEY          NOT NULL,
    `code`         text                      NOT NULL,
    `status`       text    DEFAULT 'CREATED' NOT NULL,
    `player_count` integer DEFAULT 6         NOT NULL,
    `current_turn` text                      NOT NULL,
    `last_move_id` text    DEFAULT ''        NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lit_games_code_unique` ON `lit_games` (`code`);--> statement-breakpoint
CREATE TABLE `lit_players`
(
    `user_id` text NOT NULL,
    `game_id` text NOT NULL,
    `team_id` text,
    PRIMARY KEY (`user_id`, `game_id`),
    FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`game_id`) REFERENCES `lit_games` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`team_id`) REFERENCES `lit_teams` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lit_teams`
(
    `id`         text PRIMARY KEY   NOT NULL,
    `game_id`    text               NOT NULL,
    `name`       text               NOT NULL,
    `score`      integer DEFAULT 0  NOT NULL,
    `sets_won`   text    DEFAULT '' NOT NULL,
    `member_ids` text               NOT NULL,
    FOREIGN KEY (`game_id`) REFERENCES `lit_games` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lit_transfers`
(
    `id`          text PRIMARY KEY  NOT NULL,
    `game_id`     text              NOT NULL,
    `player_id`   text              NOT NULL,
    `timestamp`   text              NOT NULL,
    `description` text              NOT NULL,
    `success`     integer DEFAULT 0 NOT NULL,
    `transfer_to` text              NOT NULL,
    FOREIGN KEY (`game_id`) REFERENCES `lit_games` (`id`) ON UPDATE no action ON DELETE no action
);
