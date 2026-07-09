import * as auth from "@s2h/auth/router";
import * as callbreak from "@s2h/callbreak-core/router";
import * as fish from "@s2h/fish-core/router";
import * as kingdomino from "@s2h/kingdomino-core/router";
import * as splendor from "@s2h/splendor-core/router";
import * as tictactoe from "@s2h/tictactoe-core/router";
import * as wordle from "@s2h/wordle-core/router";

/**
 * The root oRPC router. Domains are nested keys, so procedures dispatch under
 * their namespace — e.g. `auth.login` is served at `/api/auth/login`,
 * `fish.askCard` at `/api/fish/askCard`.
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
	},
	wordle: { ...wordle },
	tictactoe: { ...tictactoe },
	splendor: { ...splendor },
	fish: { ...fish },
	callbreak: { ...callbreak },
	kingdomino: { ...kingdomino }
};

/** End-to-end type of the API router, consumed by the typed oRPC client. */
export type AppRouter = typeof router;
