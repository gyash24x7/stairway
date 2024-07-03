import { QueryClient } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { storage } from "./storage.ts";

export const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnMount: false,
			refetchOnReconnect: false,
			retry: false
		}
	}
} );

const BASE_URL = "http://192.168.0.132:8000/api";

export const trpcLink = ( app: "auth" | "literature" | "wordle" ) => {
	return httpLink( {
		url: `${ BASE_URL }/${ app }`,
		async headers() {
			const authToken = await storage.getItem( "authToken" );
			if ( !authToken ) {
				return {};
			}

			return { authorization: `Bearer ${ authToken }` };
		}
	} );
};