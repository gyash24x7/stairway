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
