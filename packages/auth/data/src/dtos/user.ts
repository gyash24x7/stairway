export interface IUser {
	name: string;
	avatar: string;
	email: string;
	password: string;
	salt: string;
	verified: boolean;
}

export interface UserAuthInfo {
	id: string;
	name: string;
	email: string;
	avatar: string;
	verified: boolean;
}

export class User implements IUser {
	id: string;
	name: string;
	avatar: string;
	email: string;
	password: string;
	salt: string;
	verified: boolean;

	constructor( { id, name, email, avatar, verified, salt, password }: IUser & { id: string } ) {
		this.id = id;
		this.name = name;
		this.avatar = avatar;
		this.email = email;
		this.password = password;
		this.salt = salt;
		this.verified = verified;
	}

	serialize(): IUser & { id: string } {
		const { id, name, email, avatar, verified, salt, password } = this;
		return { id, name, email, avatar, verified, salt, password };
	}
}