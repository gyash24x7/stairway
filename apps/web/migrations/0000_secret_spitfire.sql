CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`publicKey` blob NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`userId` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`avatar` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);