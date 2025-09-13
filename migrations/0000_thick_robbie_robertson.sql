CREATE TABLE `auth_passkeys`
(
    `id`             text PRIMARY KEY NOT NULL,
    `publicKey`      text             NOT NULL,
    `webauthnUserId` text             NOT NULL,
    `counter`        integer          NOT NULL,
    `createdAt`      integer          NOT NULL,
    `userId`         text             NOT NULL,
    FOREIGN KEY (`userId`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `auth_users`
(
    `id`       text PRIMARY KEY NOT NULL,
    `name`     text             NOT NULL,
    `username` text             NOT NULL,
    `avatar`   text             NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_username_unique` ON `auth_users` (`username`);