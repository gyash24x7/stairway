import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

export const HealthApiGroup = HttpApiGroup.make( "health" )
	.prefix( "/health" )
	.add(
		HttpApiEndpoint.get( "healthCheck", "/check", {
			success: Schema.Struct( { healthy: Schema.Boolean } )
		} )
	);