import { useAppSession } from "@/auth/core/sessions";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export const Route = createFileRoute( "/_sync/$" )( {
	server: {
		handlers: {
			GET: async ( { params, request } ) => {
				const upgradeHeader = request.headers.get( "Upgrade" );
				if ( !upgradeHeader || upgradeHeader !== "websocket" ) {
					return new Response( "Worker expected Upgrade: websocket", { status: 426 } );
				}

				const session = await useAppSession();
				if ( !session.data.authInfo ) {
					return new Response( "Unauthorized!", { status: 401 } );
				}

				const { _splat = "" } = params;
				const [ _sync, game, matchId ] = _splat.split( "/" );

				const id = env.SYNC_SERVER.idFromName( `${ game }:${ matchId }` );
				const syncServer = env.SYNC_SERVER.get( id );

				const req = new Request( request.url, request );
				req.headers.set( "X-User-ID", session.data.authInfo.id );

				return syncServer.fetch( req );
			}
		}
	}
} );
