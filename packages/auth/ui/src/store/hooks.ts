import { useAction } from "@s2h/ui";
import { useAuthStore } from "./store";

// Auth State Hooks
export const useAuthInfo = () => useAuthStore( state => state.authInfo );
export const useIsLoggedIn = () => useAuthStore( state => state.isLoggedIn );
export const useAuthToken = () => useAuthStore( state => state.authToken );


// Auth Action Hooks
export const useLoginAction = () => {
	const login = useAuthStore( state => state.login );
	return useAction( login );
};

export const useLogoutAction = () => {
	const logout = useAuthStore( state => state.logout );
	return useAction( logout );
};

export const useSignUpAction = () => {
	const signUp = useAuthStore( state => state.signUp );
	return useAction( signUp );
};
