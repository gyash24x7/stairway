import * as auth from "@/api/routers/auth";

/**
 * The root oRPC router. Domains are nested keys, so procedures dispatch under
 * their namespace — e.g. `auth.login` is served at `/api/auth/login`.
 * Game routers (wordle, fish, …) are added in phase 5.
 */
export const router = {
	auth: {
		me: auth.me,
		checkIfUserExists: auth.checkIfUserExists,
		getLoginOptions: auth.getLoginOptions,
		verifyLogin: auth.verifyLogin,
		getRegisterOptions: auth.getRegisterOptions,
		verifyRegistration: auth.verifyRegistration,
		logout: auth.logout
	}
};

/** End-to-end type of the API router, consumed by the typed oRPC client. */
export type AppRouter = typeof router;
