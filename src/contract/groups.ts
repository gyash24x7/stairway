import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

// Non-game API groups. Each game's group lives with the game, in
// `games/<game>/shared/contract.ts`, and is composed in `contract/api.ts`.


// --- Health Api Group ---------------------------------------

const HealthCheckEndpoint = HttpApiEndpoint.get( "healthCheck", "/check", {
	success: Schema.Struct( { healthy: Schema.Boolean } )
} );

export const HealthApiGroup = HttpApiGroup.make( "health" )
	.add( HealthCheckEndpoint )
	.prefix( "/health" );


// --- Auth Api Group ---------------------------------------

const AuthGetEndpoint = HttpApiEndpoint.get( "authGet", "/*" );
const AuthPostEndpoint = HttpApiEndpoint.post( "authPost", "/*" );

export const AuthApiGroup = HttpApiGroup.make( "auth" )
	.add( AuthGetEndpoint )
	.add( AuthPostEndpoint )
	.prefix( "/auth" );
