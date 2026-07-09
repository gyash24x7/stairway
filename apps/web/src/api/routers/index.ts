import * as auth from "@/api/routers/auth";
import * as callbreak from "@/api/routers/callbreak";
import * as fish from "@/api/routers/fish";
import * as kingdomino from "@/api/routers/kingdomino";
import * as splendor from "@/api/routers/splendor";
import * as tictactoe from "@/api/routers/tictactoe";
import * as wordle from "@/api/routers/wordle";

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
