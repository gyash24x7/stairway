import type { User as PrismaUser } from "@prisma/client";

export type UserAuthInfo = {
	id: string;
	name: string;
	email: string;
	avatar: string;
	verified: boolean;
}

export type AuthTokenData = {
	token: string;
	userId: string;
}

export type User = PrismaUser
