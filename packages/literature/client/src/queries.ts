import { useQuery } from "@tanstack/react-query";
import { getGame } from "./base";
import type { PlayerSpecificGameData } from "@literature/data";
import type { OpOps } from "@s2h/client";

export const useGetGameQuery = ( id: string, options?: OpOps<PlayerSpecificGameData> ) => useQuery( {
	queryKey: [ "literature", id ],
	queryFn: () => getGame( id ),
	...options
} );