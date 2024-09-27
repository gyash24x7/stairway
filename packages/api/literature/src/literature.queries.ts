import { Injectable, NotFoundException } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { CardHand } from "@stairway/cards";
import { LiteraturePrisma } from "./literature.prisma.ts";
import type { CardCounts, Game, Metrics, PlayerData, TeamData } from "./literature.types.ts";

@Injectable()
export class LiteratureQueries {

	constructor(
		private readonly prisma: LiteraturePrisma,
		@OgmaLogger( LiteratureQueries ) private readonly logger: OgmaService
	) {}

	async getGameData( gameId: string ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.prisma.game.findUnique( {
			where: { id: gameId },
			include: { players: true, teams: true }
		} );

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

		const cardMappings = await this.prisma.cardMapping.findMany( { where: { gameId } } );
		const cardCounts: CardCounts = {};

		Object.keys( players ).forEach( playerId => {
			cardCounts[ playerId ] = cardMappings.filter( mapping => mapping.playerId === playerId ).length;
		} );

		this.logger.debug( "<< getCardCounts()" );
		return cardCounts;
	}

	async getPlayerHand( gameId: string, playerId: string ) {
		this.logger.debug( ">> getPlayerHand()" );

		const cardMappings = await this.prisma.cardMapping.findMany( { where: { gameId, playerId } } );
		const hand = CardHand.fromMappings( cardMappings );

		this.logger.debug( "<< getPlayerHand()" );
		return hand;
	}

	async getLastMoveData( lastMoveId: string ) {
		this.logger.debug( ">> getLastMove()" );

		const ask = await this.prisma.ask.findUnique( { where: { id: lastMoveId } } );
		if ( !!ask ) {
			return { move: ask, isCall: false } as const;
		}

		const call = await this.prisma.call.findUnique( { where: { id: lastMoveId } } );
		if ( !!call ) {
			return { move: call, isCall: true } as const;
		}

		const transfer = await this.prisma.transfer.findUnique( { where: { id: lastMoveId } } );
		if ( !!transfer ) {
			return { move: transfer, isCall: false } as const;
		}

		return { move: undefined, isCall: false } as const;
	}

	async getPreviousAsks( gameId: string ) {
		this.logger.debug( ">> getPreviousAsks()" );
		const asks = await this.prisma.ask.findMany( { where: { gameId }, take: 5, orderBy: { timestamp: "desc" } } );
		this.logger.debug( "<< getPreviousAsks()" );
		return asks.slice( 0, 5 );
	}

	async getMetrics( game: Game, players: PlayerData, teams: TeamData ) {
		this.logger.debug( ">> getMetrics()" );

		const asks = await this.prisma.ask.findMany( { where: { gameId: game.id } } );
		const calls = await this.prisma.call.findMany( { where: { gameId: game.id } } );
		const transfers = await this.prisma.transfer.findMany( { where: { gameId: game.id } } );

		const metrics: Metrics = { player: [], team: [] };

		for ( const playerId of Object.keys( players ) ) {
			const asksByPlayer = asks.filter( ask => ask.playerId === playerId );
			const successfulAsks = asksByPlayer.filter( ask => ask.success );
			const callsByPlayer = calls.filter( call => call.playerId === playerId );
			const successfulCalls = callsByPlayer.filter( call => call.success );
			const transfersByPlayer = transfers.filter( transfer => transfer.playerId === playerId );

			metrics.player.push( {
				playerId,
				totalAsks: asksByPlayer.length,
				successfulAsks: successfulAsks.length,
				totalCalls: callsByPlayer.length,
				successfulCalls: successfulCalls.length,
				totalTransfers: transfersByPlayer.length
			} );
		}

		for ( const teamId of Object.keys( teams ) ) {
			metrics.team.push( {
				teamId,
				score: teams[ teamId ].score,
				setsWon: teams[ teamId ].setsWon
			} );
		}

		this.logger.debug( "<< getMetrics()" );
		return metrics;
	}
}