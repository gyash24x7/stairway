import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";


// --- Auth Api Group ---------------------------------------

const AuthGetEndpoint = HttpApiEndpoint.get( "authGet", "/*" );
const AuthPostEndpoint = HttpApiEndpoint.post( "authPost", "/*" );

export const AuthApiGroup = HttpApiGroup.make( "auth" )
	.add( AuthGetEndpoint )
	.add( AuthPostEndpoint )
	.prefix( "/auth" );
