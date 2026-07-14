import { getClient } from "@s2h/api/client";
import type { AuthInfo } from "@s2h/utils/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const AUTH_ME_KEY = [ "auth", "me" ] as const;

/** Fetch the current user from the `auth.me` HTTP endpoint (reads the session cookie). */
const fetchMe = (): Promise<AuthInfo | null> =>
	Effect.runPromise( getClient( API_URL ).auth.me() );

/**
 * Client-side auth state, backed by the `auth.me` query (reads the session cookie).
 * Replaces the server-rendered `requestInfo.ctx.authInfo`.
 */
export function useAuth(): { authInfo: AuthInfo | null; isLoading: boolean } {
	const { data, isLoading } = useQuery( { queryKey: AUTH_ME_KEY, queryFn: fetchMe } );
	return { authInfo: data ?? null, isLoading };
}

/** Returns a callback that refetches the current-user query (call after login/logout). */
export function useRefreshAuth(): () => Promise<void> {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries( { queryKey: AUTH_ME_KEY } );
}
