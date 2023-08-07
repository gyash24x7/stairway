import { useQuery } from "@tanstack/react-query";
import { getGame } from "./base.js";

export const useGetGameQuery = ( id: string ) => useQuery( {
	queryKey: [ "literature", id ],
	queryFn: () => getGame( id )
} );