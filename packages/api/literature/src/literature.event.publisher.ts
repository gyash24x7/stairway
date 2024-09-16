import { Injectable } from "@nestjs/common";
import { LoggerFactory } from "@shared/api";
import { io, Socket } from "socket.io-client";

@Injectable()
export class LiteratureEventPublisher {

	private readonly logger = LoggerFactory.getLogger( LiteratureEventPublisher );
	private readonly socket: Socket;

	constructor() {
		this.socket = io( "http://localhost:3000/_internal" );
	}

	publishPlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
		this.socket.emit( "player-event", { gameId, playerId, event, data } );
		this.logger.debug( "Published Player Event %o", { gameId, playerId, event } );
	}

	publishGameEvent( gameId: string, event: string, data: any ) {
		this.socket.emit( "game-event", { gameId, event, data } );
		this.logger.debug( "Published Game Event %o", { gameId, event } );
	}
}