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

export type CreateUserInput = {
	name: string;
	email: string;
	password: string;
}

export type LoginInput = {
	email: string;
	password: string;
}

export type VerifyUserInput = {
	salt: string;
	id: string;
}
