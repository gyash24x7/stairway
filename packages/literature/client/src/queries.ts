import { useQuery } from "@tanstack/react-query";
import { getGame } from "./base";
import type { IAggregatedGameData } from "@literature/data";

type QueryOptions<T> = {
	onSuccess?: ( data: T ) => void
	onError?: ( e: any ) => void;
}

export const useGetGameQuery = ( id: string, options?: QueryOptions<IAggregatedGameData> ) => useQuery( {
	queryKey: [ "literature", id ],
	queryFn: () => getGame( id ),
	...options
} );