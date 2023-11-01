import { authClient } from "./client";
import type { AuthState } from "./store";
import { useAuthStore } from "./store";

export async function authStoreLoader() {
	const initialState: AuthState = {
		isLoggedIn: false,
		authInfo: null,
		authToken: null
	};

	const authInfo = await authClient.loadAuthInfo();
	initialState.authInfo = authInfo;
	initialState.isLoggedIn = !!authInfo;

	if ( !!authInfo ) {
		const { token } = await authClient.getToken();
		initialState.authToken = token;
	}

	useAuthStore.setState( initialState );
	return initialState;
}