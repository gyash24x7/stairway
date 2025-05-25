export type AuthInfo = {
	id: string;
	name: string;
	email: string;
	avatar: string;
}

export type AuthContext = {
	authInfo: AuthInfo;
}

export type Session = {
	id: string;
	userId: string;
	expiresAt: number;
}
