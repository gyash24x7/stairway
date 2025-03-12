export namespace Auth {
	export type Info = {
		id: string;
		name: string;
		email: string;
		avatar: string;
	}

	export type Context = {
		authInfo: Info;
	}
}