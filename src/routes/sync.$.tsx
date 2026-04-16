import { useAppSession } from "@/auth/core/sessions";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

function getMatchStub( game: string, matchId: string ) {
	switch ( game ) {
		case "tic-tac-toe": return env.TICTACTOE_SERVER.get( env.TICTACTOE_SERVER.idFromName( matchId ) );
		case "callbreak": return env.CALLBREAK_SERVER.get( env.CALLBREAK_SERVER.idFromName( matchId ) );
		case "splendor": return env.SPLENDOR_SERVER.get( env.SPLENDOR_SERVER.idFromName( matchId ) );
		case "fish": return env.FISH_SERVER.get( env.FISH_SERVER.idFromName( matchId ) );
		case "kingdomino": return env.KINGDOMINO_SERVER.get( env.KINGDOMINO_SERVER.idFromName( matchId ) );
		case "wordle": return env.WORDLE_SERVER.get( env.WORDLE_SERVER.idFromName( matchId ) );
		default: throw new Error( `Unknown game: ${ game }` );
	}
}

export const Route = createFileRoute( "/sync/$" )( {
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
				const [ game, matchId ] = _splat.split( "/" );

				const stub = getMatchStub( game, matchId );

				const req = new Request( request.url, request );
				req.headers.set( "X-User-ID", session.data.authInfo.id );

				return stub.fetch( req );
			}
		}
	}
} );
