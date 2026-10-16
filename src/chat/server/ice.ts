import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import type { IceServer as IceServerType } from "@/chat/schema";
import { IceServer } from "@/chat/schema";


/** Public STUN, enough for most pairs on home networks and nothing else. */
const STUN: IceServerType = { urls: [ "stun:stun.cloudflare.com:3478" ] };

/**
 * How long a TURN credential is good for, and how long one is reused for.
 *
 * Credentials are minted per process and shared, rather than per connection,
 * because a call never outlives a credential's use: the browser only presents
 * it while gathering candidates. Reusing one for an hour of a twelve-hour life
 * keeps Cloudflare off the path of every socket opening, and leaves any
 * credential that was handed out good for long after the last one was.
 */
const CREDENTIAL_TTL = Duration.hours( 12 );
const REUSE_FOR = Duration.hours( 1 );

const GeneratedIceServers = Schema.Struct( {
	iceServers: Schema.Array( Schema.Struct( {
		urls: Schema.Union( [ Schema.String, Schema.Array( Schema.String ) ] ),
		username: Schema.optional( Schema.String ),
		credential: Schema.optional( Schema.String )
	} ) )
} );

/**
 * The ICE servers a browser should build its peer connections with.
 *
 * STUN alone leaves something like one pair in seven unable to connect — two
 * people behind carrier-grade or corporate NAT have no address the other can
 * reach — so production relays through Cloudflare's managed TURN. Its long-term
 * key never leaves the server: what the browser is given is a short-lived
 * username and password minted from it.
 *
 * Without `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` the server still boots, with
 * STUN only, the same way it boots without VAPID keys and with push off. If
 * Cloudflare cannot be reached the answer falls back to STUN for that
 * connection and is asked again on the next one; a failure is never cached.
 */
export class IceServers extends Context.Service<IceServers, {
	readonly get: Effect.Effect<ReadonlyArray<IceServerType>>;
}>()( "chat/IceServers" ) {}

export const IceServersLive = Layer.effect(
	IceServers,
	Effect.gen( function* () {
		const key = yield* Config.option( Config.all( {
			id: Config.String( "TURN_KEY_ID" ),
			token: Config.Redacted( "TURN_KEY_API_TOKEN" )
		} ) ).pipe( Effect.orDie );

		if ( Option.isNone( key ) ) {
			yield* Effect.logWarning( "chat: no TURN key configured, video calls use STUN only" );
			return IceServers.of( { get: Effect.succeed( [ STUN ] ) } );
		}

		const { id, token } = key.value;
		const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${ id }/credentials/generate-ice-servers`;

		const generate = Effect.tryPromise( () => fetch( url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${ Redacted.value( token ) }`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify( { ttl: Duration.toSeconds( CREDENTIAL_TTL ) } )
		} ).then( response => {
			if ( !response.ok ) {
				throw new Error( `TURN credentials: ${ response.status }` );
			}
			return response.json();
		} ) ).pipe(
			Effect.flatMap( Schema.decodeUnknownEffect( GeneratedIceServers ) ),
			Effect.map( ( { iceServers } ) => iceServers.map( server => IceServer.make( {
				...server,
				urls: typeof server.urls === "string" ? [ server.urls ] : server.urls
			} ) ) )
		);

		const cached = yield* generate.pipe(
			Effect.cachedWithTTL( exit => Exit.isSuccess( exit ) ? REUSE_FOR : Duration.zero )
		);

		const get = cached.pipe(
			Effect.catchCause( cause => Effect.logWarning( "chat: TURN credentials unavailable", cause ).pipe(
				Effect.as( [ STUN ] )
			) )
		);

		return IceServers.of( { get } );
	} )
);
