import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMeFn } from "@/auth/client/client.ts";

const AUTH_ME_KEY = [ "auth", "me" ] as const;

export function useAuth() {
	const { data, isLoading } = useQuery( { queryKey: AUTH_ME_KEY, queryFn: fetchMeFn } );
	return { authInfo: data ?? null, isLoading };
}

/** Returns a callback that refetches the current-user query (call after login/logout). */
export function useRefreshAuth() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries( { queryKey: AUTH_ME_KEY } );
}
