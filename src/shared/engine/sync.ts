import { createLogger } from "@/shared/utils/logger";
import { DurableObject } from "cloudflare:workers";

export class SyncServer extends DurableObject {

	private readonly logger = createLogger( "Websocket:DO" );
	private readonly connections = new Map<WebSocket, { userId: string }>();

	constructor( ctx: DurableObjectState, env: Env ) {
		super( ctx, env );
		this.ctx.getWebSockets().forEach( ( ws ) => {
			let attachment = ws.deserializeAttachment();
			if ( attachment ) {
				this.connections.set( ws, { ...attachment } );
			}
		} );

		const wsResponsePair = new WebSocketRequestResponsePair( "ping", "pong" );
		this.ctx.setWebSocketAutoResponse( wsResponsePair );
	}

	override async fetch( request: Request ) {
		this.logger.debug( ">> fetch()" );

		const userId = request.headers.get( "X-User-Id" );
		if ( !userId ) {
			this.logger.warn( "Unauthorized WebSocket connection attempt." );
			this.logger.debug( "<< fetch()" );
			return new Response( "Unauthorized", { status: 401 } );
		}

		const webSocketPair = new WebSocketPair();
		const [ client, server ] = Object.values( webSocketPair );
		this.ctx.acceptWebSocket( server );

		server.serializeAttachment( { userId } );
		this.connections.set( server, { userId } );

		this.logger.debug( `User ${ userId } connected.` );
		this.logger.debug( "<< fetch()" );
		return new Response( null, { status: 101, webSocket: client } );
	}

	override async webSocketClose( ws: WebSocket, code: number, reason: string ) {
		ws.close( code, reason ?? "Closed by DO!" );
		this.logger.debug( "Connection closed!", code, reason );
	}

	public async publish( userId: string, data: any ) {
		this.logger.debug( ">> publish()" );

		const [ ws ] = this.connections.entries()
			.filter( ( [ ws, data ] ) => data.userId === userId && ws.readyState === WebSocket.OPEN )
			.map( ( [ ws ] ) => ws );

		if ( !ws ) {
			this.logger.error( "Connection not found for user: %s", userId );
			this.logger.debug( "<< publish()" );
			return;
		}

		ws.send( JSON.stringify( { data } ) );

		this.logger.debug( "<< publish()" );
	}
}