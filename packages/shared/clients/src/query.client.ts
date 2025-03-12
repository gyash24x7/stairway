import { QueryClient } from "@tanstack/react-query";

export const baseUrl = import.meta.env[ "PUBLIC_API_URL" ] ?? "http://localhost:8000";
export const wssUrl = import.meta.env[ "PUBLIC_WSS_URL" ] ?? "ws://localhost:8000";

export const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			refetchOnMount: false,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false
		}
	}
} );
