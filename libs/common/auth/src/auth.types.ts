import { Collection } from "mongodb";

export interface UserAuthInfo {
	id: string;
	name: string;
	avatar: string;
	verified: boolean;
}

export interface IUser {
	id: string;
	name: string;
	avatar: string;
	verified: boolean;
	password: string;
	salt: string;
}

export const USERS_COLLECTION = "users";

export type Db = {
	users: () => Collection<IUser>
}