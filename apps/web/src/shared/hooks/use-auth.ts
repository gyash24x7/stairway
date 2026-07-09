import { orpc } from "@s2h/client/query";
import type { AuthInfo } from "@s2h/shared/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Client-side auth state, backed by the `auth.me` query (reads the session cookie).
 * Replaces the server-rendered `requestInfo.ctx.authInfo`.
 */
export function useAuth(): { authInfo: AuthInfo | null; isLoading: boolean } {
	const { data, isLoading } = useQuery( orpc.auth.me.queryOptions() );
	return { authInfo: data ?? null, isLoading };
}

/** Returns a callback that refetches the current-user query (call after login/logout). */
export function useRefreshAuth(): () => Promise<void> {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries( { queryKey: orpc.auth.me.key() } );
}
