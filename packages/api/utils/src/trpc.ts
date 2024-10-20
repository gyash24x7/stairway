import { getAuthInfo } from "@stairway/api/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

export type UserAuthInfo = {
	id: string;
	name: string;
	email: string;
	avatar: string;
}

export type AuthContext = { authInfo: UserAuthInfo };


export const trpc = initTRPC.context<AuthContext>().create( {
	transformer: superjson
} );

export async function createContextFn(): Promise<AuthContext> {
	const authInfo = await getAuthInfo();
	if ( !authInfo ) {
		throw new TRPCError( { code: "UNAUTHORIZED", message: "User is not authenticated!" } );
	}

	return { authInfo };
}