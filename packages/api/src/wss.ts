import type { AuthInfo } from "@s2h/auth/types";
import { createLogger } from "@s2h/utils/logger";
import { DurableObject } from "cloudflare:workers";
import { SessionService } from "./sessions";

type CloudflareEnv = {
	SESSION_KV: KVNamespace;
	AUTH_SECRET_KEY: string;
}

export class WebsocketServer extends DurableObject<CloudflareEnv> {

	private readonly logger = createLogger( "Websocket:DO" );
	private readonly sessions = new Map<WebSocket, AuthInfo>();
	private readonly sessionService;

	constructor( ctx: DurableObjectState, env: CloudflareEnv ) {
		super( ctx, env );
		this.ctx.getWebSockets().forEach( ( ws ) => {
			let attachment = ws.deserializeAttachment();
			if ( attachment ) {
				this.sessions.set( ws, { ...attachment } );
			}
		} );

		this.sessionService = new SessionService( env.SESSION_KV, env.AUTH_SECRET_KEY );
		const wsResponsePair = new WebSocketRequestResponsePair( "ping", "pong" );
		this.ctx.setWebSocketAutoResponse( wsResponsePair );
	}

	override async fetch( request: Request ) {
		this.logger.debug( ">> fetch()" );

		const session = await this.sessionService.validateSession( request.headers );
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

	public async broadcast( data: Record<string, any> ) {
		this.logger.debug( ">> broadcast()" );

		for ( let [ ws, authInfo ] of this.sessions ) {
			ws.send( JSON.stringify( data[ authInfo.id ] ) );
		}

		this.logger.debug( "<< broadcast()" );
	}
}