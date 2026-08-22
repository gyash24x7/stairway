import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMeFn } from "@/auth/client/client.ts";

const AUTH_ME_KEY = [ "auth", "me" ] as const;

/**
 * The current user, or `null` when signed out — and, separately, whether the
 * question could even be asked.
 *
 * The distinction matters more than it looks. `GET /api/auth/me` answers `null`
 * for a genuine signed-out visitor, but the query client runs with
 * `retry: false`, so a network failure leaves `data` undefined. Collapsing both
 * into `null` tells a signed-in user on a dead connection that they are logged
 * out, and invites a passkey ceremony that cannot possibly succeed offline.
 *
 * `isPending` rather than `isLoading`: in TanStack Query v5 `isLoading` is
 * `isPending && isFetching`, so a failed query reports `isLoading: false` and
 * would otherwise fall straight through to the signed-out branch.
 */
export function useAuth() {
	const query = useQuery( { queryKey: AUTH_ME_KEY, queryFn: fetchMeFn } );
	return {
		authInfo: query.data ?? null,
		isLoading: query.isPending,
		isError: query.isError,
		error: query.error,
		refetch: query.refetch
	};
}

/** Returns a callback that refetches the current-user query (call after login/logout). */
export function useRefreshAuth() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries( { queryKey: AUTH_ME_KEY } );
}
