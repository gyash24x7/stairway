/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `auth_accounts` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `auth_accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token` to the `auth_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `auth_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `auth_verifications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "auth"."auth_accounts"
    DROP COLUMN "expiresAt",
    ADD COLUMN "accessTokenExpiresAt"  TIMESTAMP(3),
    ADD COLUMN "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "idToken"               TEXT,
    ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3),
    ADD COLUMN "scope"                 TEXT,
    ADD COLUMN "updatedAt"             TIMESTAMP(3) NOT NULL;


-- AlterTable
ALTER TABLE "auth"."auth_sessions"
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "token"     TEXT         NOT NULL,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "auth"."auth_verifications"
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
