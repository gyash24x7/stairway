import { useAppSession } from "@/auth/core/sessions";
import { getGameStub } from "@/shared/utils/stub";
import { createFileRoute } from "@tanstack/react-router";

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
				const [ game, gameId ] = _splat.split( "/" );

				const stub = getGameStub( game, gameId );

				const req = new Request( request.url, request );
				req.headers.set( "X-User-ID", session.data.authInfo.id );

				return stub.fetch( req );
			}
		}
	}
} );
