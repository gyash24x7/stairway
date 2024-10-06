import type { UserAuthInfo } from "@auth/api";

const authInfoUrl = process.env.NODE_ENV === "development"
	? "http://localhost:8000/api/auth/user"
	: "/api/auth/user";

const logoutUrl = process.env.NODE_ENV === "development"
	? "http://localhost:8000/api/auth/logout"
	: "/api/auth/logout";

export const client = {
	fetchAuthInfo: async () => {
		const res = await fetch( authInfoUrl, { credentials: "include" } );
		if ( res.status === 200 ) {
			const authInfo: UserAuthInfo = await res.json();
			return authInfo;
		}

		return null;
	},
	logout: async () => {
		await fetch( logoutUrl, { method: "DELETE", credentials: "include" } );
	}
};

export type * from "@auth/api";