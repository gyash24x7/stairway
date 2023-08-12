import { useQuery } from "@tanstack/react-query";
import { me } from "./base.js";
import type { OpOps } from "@s2h/client";
import type { UserAuthInfo } from "@auth/data";

export const useMeQuery = ( ops?: OpOps<UserAuthInfo> ) => useQuery( {
	queryKey: [ "me" ],
	queryFn: () => me(),
	...ops
} );