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

--> statement-breakpoint

CREATE TABLE `passkeys`
(
    `id`        text PRIMARY KEY  NOT NULL,
    `publicKey` blob              NOT NULL,
    `counter`   integer DEFAULT 0 NOT NULL,
    `userId`    text              NOT NULL
);

--> statement-breakpoint

CREATE TABLE `users`
(
    `id`       text PRIMARY KEY NOT NULL,
    `name`     text             NOT NULL,
    `username` text             NOT NULL,
    `avatar`   text             NOT NULL
);

--> statement-breakpoint

CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);

--> statement-breakpoint

CREATE TABLE `webauthn_options`
(
    `username`  text PRIMARY KEY NOT NULL,
    `challenge` text             NOT NULL
);
