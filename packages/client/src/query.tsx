import { QueryClient, QueryClientProvider as BaseQueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

export const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			refetchInterval: false,
			refetchOnMount: false,
			refetchOnReconnect: false,
			refetchOnWindowFocus: false
		}
	}
} );

export function QueryClientProvider( props: { children: ReactNode } ) {
	return <BaseQueryClientProvider client={ queryClient }>{ props.children }</BaseQueryClientProvider>;
}
