CREATE TABLE IF NOT EXISTS `accounts`
(
    `id`                       text PRIMARY KEY,
    `account_id`               text    NOT NULL,
    `provider_id`              text    NOT NULL,
    `user_id`                  text    NOT NULL,
    `access_token`             text,
    `refresh_token`            text,
    `id_token`                 text,
    `access_token_expires_at`  integer,
    `refresh_token_expires_at` integer,
    `scope`                    text,
    `password`                 text,
    `created_at`               integer NOT NULL,
    `updated_at`               integer NOT NULL,
    CONSTRAINT `fk_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `games`
(
    `id`         text PRIMARY KEY,
    `code`       text                  NOT NULL,
    `game`       text                  NOT NULL,
    `completed`  integer DEFAULT false NOT NULL,
    `created_at` integer               NOT NULL
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `passkeys`
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

CREATE TABLE IF NOT EXISTS `sessions`
(
    `id`         text PRIMARY KEY,
    `token`      text    NOT NULL UNIQUE,
    `user_id`    text    NOT NULL,
    `expires_at` integer NOT NULL,
    `ip_address` text,
    `user_agent` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `users`
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

CREATE TABLE IF NOT EXISTS `verifications`
(
    `id`         text PRIMARY KEY,
    `identifier` text    NOT NULL,
    `value`      text    NOT NULL,
    `expires_at` integer NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `account_user_id_idx` ON `accounts` (`user_id`);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_games_code` ON `games` (`code`);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `passkey_user_id_idx` ON `passkeys` (`user_id`);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `passkey_credential_id_idx` ON `passkeys` (`credential_id`);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `session_user_id_idx` ON `sessions` (`user_id`);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `verification_identifier_idx` ON `verifications` (`identifier`);