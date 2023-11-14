import type { UserAuthInfo } from "@auth/data";
import { produce } from "immer";
import { create } from "zustand";
import { authClient } from "./client";

export type AuthState = {
	isLoggedIn: boolean;
	authInfo?: UserAuthInfo | null;
};

export type AuthActions = {
	logout: () => Promise<void>;
}

export const useAuthStore = create<AuthActions & AuthState>()( ( set ) => {
	return {
		isLoggedIn: false,
		authInfo: undefined,
		logout: async () => {
			await authClient.logout();
			set( produce( state => {
				state.isLoggedIn = false;
				state.authInfo = undefined;
			} ) );
		}
	};
} );
