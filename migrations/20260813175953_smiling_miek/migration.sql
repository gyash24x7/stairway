CREATE TABLE `channels`
(
    `id`         text PRIMARY KEY,
    `ref_type`   text    NOT NULL,
    `ref_id`     text    NOT NULL,
    `label`      text,
    `policy`     text    NOT NULL,
    `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `games`
(
    `id`         text PRIMARY KEY,
    `code`       text                  NOT NULL UNIQUE,
    `game`       text                  NOT NULL,
    `completed`  integer DEFAULT false NOT NULL,
    `created_at` integer               NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passkeys`
(
    `id`            text PRIMARY KEY,
    `name`          text,
    `public_key`    text    NOT NULL,
    `user_id`       text    NOT NULL,
    `credential_id` text    NOT NULL,
    `counter`       integer NOT NULL,
    `device_type`   text    NOT NULL,
    `backed_up`     integer NOT NULL,
    `transports`    text,
    `aaguid`        text,
    `created_at`    integer,
    CONSTRAINT `fk_passkeys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `players`
(
    `id`     text,
    `name`   text NOT NULL,
    `image`  text,
    `gameId` text,
    CONSTRAINT `players_pk` PRIMARY KEY (`id`, `gameId`),
    CONSTRAINT `fk_players_gameId_games_id_fk` FOREIGN KEY (`gameId`) REFERENCES `games` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users`
(
    `id`             text PRIMARY KEY,
    `name`           text                  NOT NULL,
    `email`          text                  NOT NULL UNIQUE,
    `email_verified` integer DEFAULT false NOT NULL,
    `image`          text,
    `created_at`     integer               NOT NULL,
    `updated_at`     integer               NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_channels_ref` ON `channels` (`ref_type`, `ref_id`);--> statement-breakpoint
CREATE INDEX `idx_games_code` ON `games` (`code`);--> statement-breakpoint
CREATE INDEX `passkey_user_id_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credential_id_idx` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_players_id` ON `players` (`id`);--> statement-breakpoint
CREATE INDEX `idx_players_gameId` ON `players` (`gameId`);