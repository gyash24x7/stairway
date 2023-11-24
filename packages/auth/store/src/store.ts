import type { User } from "@prisma/client";
import { produce } from "immer";
import { create } from "zustand";
import { authClient } from "./client.js";

export type AuthState = {
	isLoggedIn: boolean;
	authUser?: User | null;
};

export type AuthActions = {
	logout: () => Promise<void>;
}

export const useAuthStore = create<AuthActions & AuthState>()( ( set ) => {
	return {
		isLoggedIn: false,
		authUser: undefined,
		logout: async () => {
			await authClient.logout();
			set( produce( state => {
				state.isLoggedIn = false;
				state.authUser = undefined;
			} ) );
		}
	};
} );
