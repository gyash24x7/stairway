import { authClient } from "./client";
import type { AuthState } from "./store";
import { useAuthStore } from "./store";

export async function authStoreLoader() {
	const initialState: AuthState = { isLoggedIn: false, authUser: null };

	const authUser = await authClient.loadAuthUser();
	initialState.authUser = authUser;
	initialState.isLoggedIn = !!authUser;

	useAuthStore.setState( initialState );
	return initialState;
}