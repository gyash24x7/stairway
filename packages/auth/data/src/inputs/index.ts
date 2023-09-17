export class CreateUserInput {
	name: string;
	email: string;
	password: string;
}

export class LoginInput {
	email: string;
	password: string;
}

export class VerifyUserInput {
	salt: string;
	id: string;
}
