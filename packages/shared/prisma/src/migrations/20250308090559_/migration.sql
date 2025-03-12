/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `auth_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth"."auth_sessions"("token");
