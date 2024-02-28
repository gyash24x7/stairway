CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."users"
(
    "id"     text NOT NULL,
    "name"   text NOT NULL,
    "avatar" text NOT NULL,
    "email"  text NOT NULL,
    CONSTRAINT "users_email_unique" UNIQUE ("email")
);
