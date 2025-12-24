import { validateSession } from "@s2h/auth/sessions";
import type { AuthInfo } from "@s2h/auth/types";
import { createLogger } from "@s2h/utils/logger";
import { DurableObject } from "cloudflare:workers";

export class WebsocketServer extends DurableObject {

	private readonly logger = createLogger( "Websocket:DO" );
	private readonly sessions = new Map<WebSocket, AuthInfo>();

	constructor( ctx: DurableObjectState, env: Env ) {
		super( ctx, env );
		this.ctx.getWebSockets().forEach( ( ws ) => {
			let attachment = ws.deserializeAttachment();
			if ( attachment ) {
				this.sessions.set( ws, { ...attachment } );
			}
		} );

		const wsResponsePair = new WebSocketRequestResponsePair( "ping", "pong" );
		this.ctx.setWebSocketAutoResponse( wsResponsePair );
	}

	override async fetch( request: Request ) {
		this.logger.debug( ">> fetch()" );

		const session = await validateSession( this.env, request.headers );
		if ( !!session?.authInfo ) {
			const webSocketPair = new WebSocketPair();
			const [ client, server ] = Object.values( webSocketPair );
			this.ctx.acceptWebSocket( server );

			server.serializeAttachment( session.authInfo );
			this.sessions.set( server, session.authInfo );

			this.logger.debug( `User ${ session.authInfo.username } connected.` );
			this.logger.debug( "<< fetch()" );
			return new Response( null, { status: 101, webSocket: client } );
		}

		this.logger.warn( "Unauthorized WebSocket connection attempt." );
		this.logger.debug( "<< fetch()" );
		return new Response( "Unauthorized", { status: 401 } );
	}

	override async webSocketClose( ws: WebSocket, code: number, reason: string ) {
		ws.close( code, reason ?? "Closed by DO!" );
	}

	public async broadcast( data: Record<string, any>, message: string ) {
		this.logger.debug( ">> broadcast()" );

		for ( let [ ws, authInfo ] of this.sessions ) {
			ws.send( JSON.stringify( { message, data: data[ authInfo.id ] } ) );
		}

		this.logger.debug( "<< broadcast()" );
	}
}