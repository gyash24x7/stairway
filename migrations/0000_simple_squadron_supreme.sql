CREATE TABLE `auth_passkeys`
(
    `id`               text PRIMARY KEY  NOT NULL,
    `public_key`       blob              NOT NULL,
    `user_id`          text              NOT NULL,
    `webauthn_user_id` text              NOT NULL,
    `counter`          integer           NOT NULL,
    `device_type`      text              NOT NULL,
    `backed_up`        integer DEFAULT 0 NOT NULL,
    `transports`       text,
    FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`id`) ON UPDATE no action ON DELETE no action
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