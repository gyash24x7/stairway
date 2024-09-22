import { Injectable, NotFoundException } from "@nestjs/common";
import { LoggerFactory } from "@shared/api";
import { CardHand } from "@stairway/cards";
import { LiteratureRepository } from "./literature.repository.ts";
import type { CardCounts, PlayerData, TeamData } from "./literature.types.ts";

@Injectable()
export class LiteratureQueries {

	private readonly logger = LoggerFactory.getLogger( LiteratureQueries );

	constructor( private readonly repository: LiteratureRepository ) {}

	async getGameData( gameId: string ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.repository.getGameById( gameId );
		if ( !data ) {
			this.logger.error( "Game Not Found!" );
			throw new NotFoundException();
		}

		const { players, teams, ...game } = data;
		const playerMap: PlayerData = {};
		players.forEach( player => {
			playerMap[ player.id ] = player;
		} );

		const teamMap: TeamData = {};
		teams.forEach( team => {
			teamMap[ team.id ] = team;
		} );

		this.logger.debug( "<< getGameData()" );
		return { game, players: playerMap, teams: teamMap };
	}

	async getCardCounts( gameId: string, players: PlayerData ) {
		this.logger.debug( ">> getCardCounts()" );

		const cardMappings = await this.repository.getCardMappingsForGame( gameId );
		const cardCounts: CardCounts = {};

		Object.keys( players ).forEach( playerId => {
			cardCounts[ playerId ] = cardMappings.filter( mapping => mapping.playerId === playerId ).length;
		} );

		this.logger.debug( "<< getCardCounts()" );
		return cardCounts;
	}

	async getPlayerHand( gameId: string, playerId: string ) {
		this.logger.debug( ">> getPlayerHand()" );

		const cardMappings = await this.repository.getCardMappingsForPlayer( gameId, playerId );
		const hand = CardHand.fromMappings( cardMappings );

		this.logger.debug( "<< getPlayerHand()" );
		return hand;
	}

	async getLastMoveData( lastMoveId: string ) {
		this.logger.debug( ">> getLastMove()" );

		const ask = await this.repository.getAskMove( lastMoveId );
		if ( !!ask ) {
			return { move: ask, isCall: false } as const;
		}

		const call = await this.repository.getCallMove( lastMoveId );
		if ( !!call ) {
			return { move: call, isCall: true } as const;
		}

		const transfer = await this.repository.getTransferMove( lastMoveId );
		if ( !!transfer ) {
			return { move: transfer, isCall: false } as const;
		}

		return { move: undefined, isCall: false } as const;
	}

	async getPreviousAsks( gameId: string ) {
		this.logger.debug( ">> getPreviousAsks()" );
		const asks = await this.repository.getAskMoves( gameId );
		this.logger.debug( "<< getPreviousAsks()" );
		return asks;
	}
}