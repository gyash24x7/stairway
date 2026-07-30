import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuthInfo } from "@/auth/shared/schema.ts";
import { fetchMeFn } from "@/auth/client/client.ts";

const AUTH_ME_KEY = [ "auth", "me" ] as const;

export function useAuth(): { authInfo: AuthInfo | null; isLoading: boolean } {
	const { data, isLoading } = useQuery( { queryKey: AUTH_ME_KEY, queryFn: fetchMeFn } );
	return { authInfo: data ?? null, isLoading };
}

/** Returns a callback that refetches the current-user query (call after login/logout). */
export function useRefreshAuth(): () => Promise<void> {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries( { queryKey: AUTH_ME_KEY } );
}
