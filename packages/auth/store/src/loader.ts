import { authClient } from "./client.js";
import type { AuthState } from "./store.js";
import { useAuthStore } from "./store.js";

export async function authStoreLoader() {
	const initialState: AuthState = { isLoggedIn: false, authUser: null };

	const authUser = await authClient.loadAuthUser();
	initialState.authUser = authUser;
	initialState.isLoggedIn = !!authUser;

	useAuthStore.setState( initialState );
	return initialState;
}