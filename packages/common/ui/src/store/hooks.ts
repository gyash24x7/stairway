import { useAction } from "@s2h/ui";
import { useAuthStore } from "./store";

// Auth State Hooks
export const useAuthUser = () => useAuthStore( state => state.authUser );
export const useIsLoggedIn = () => useAuthStore( state => state.isLoggedIn );
export const useLogout = () => useAuthStore( state => state.logout );

// Auth Action Hooks
export const useLogoutAction = () => {
	const logout = useLogout();
	return useAction( logout );
};
