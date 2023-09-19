import { useQuery } from "@tanstack/react-query";
import { me } from "./base";
import type { OpOps } from "@s2h/client";
import type { UserAuthInfo } from "@auth/data";

export const useMeQuery = ( ops?: OpOps<UserAuthInfo> ) => useQuery( {
	queryKey: [ "me" ],
	queryFn: () => me().catch( () => null ),
	...ops
} );