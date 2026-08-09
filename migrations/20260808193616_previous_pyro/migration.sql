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

CREATE INDEX `idx_channels_ref` ON `channels` (`ref_type`, `ref_id`);