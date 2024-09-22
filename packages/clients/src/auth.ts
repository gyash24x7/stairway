import type { UserAuthInfo } from "@auth/api";
import { BACKEND_URL } from "./utils.ts";

export const LOGIN_URL = `${ BACKEND_URL }/api/auth/login`;

export const client = {
	fetchAuthInfo: async () => {
		const res = await fetch( `${ BACKEND_URL }/api/auth/user`, { credentials: "include" } );
		if ( res.status === 200 ) {
			const authInfo: UserAuthInfo | undefined = await res.json().catch();
			return authInfo;
		}

		return undefined;
	},
	logout: async () => {
		await fetch( `${ BACKEND_URL }/api/auth/logout`, { method: "DELETE", credentials: "include" } );
	}
};

export type * from "@auth/api";