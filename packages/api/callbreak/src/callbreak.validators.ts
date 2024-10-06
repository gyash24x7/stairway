import type { UserAuthInfo } from "@auth/api";
import { Injectable } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { CardHand, getBestCardPlayed, getPlayableCards, PlayingCard } from "@stairway/cards";
import { TRPCError } from "@trpc/server";
import { format } from "node:util";
import type { DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "./callbreak.inputs.ts";
import { CallBreakPrisma } from "./callbreak.prisma.ts";
import type { Game, PlayerData } from "./callbreak.types.ts";

@Injectable()
export class CallBreakValidators {

	constructor(
		private readonly prisma: CallBreakPrisma,
		@OgmaLogger( CallBreakValidators ) private readonly logger: OgmaService
	) {}

	async validateJoinGame( input: JoinGameInput, { id }: UserAuthInfo ) {
		this.logger.debug( ">> validateJoinGame()" );

		const game = await this.prisma.game.findUnique( {
			where: { code: input.code },
			include: { players: true }
		} );

		if ( !game ) {
			this.logger.error( format( "Game Not Found: %s", input.code ) );
			throw new TRPCError( { code: "NOT_FOUND", message: "Game Not Found!" } );
		}

		if ( game.players.find( player => player.id === id ) ) {
			this.logger.warn( format( "Player Already Joined: %s", id ) );
			return { alreadyJoined: true, game };
		}

		if ( game.players.length >= 4 ) {
			this.logger.error( format( "Game Full: %s", game.id ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: "Game Full!" } );
		}

		this.logger.debug( "<< validateJoinGame()" );
		return { alreadyJoined: false, game };
	}

	async validateAddBots( game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateAddBots()" );

		const botCount = 4 - Object.keys( players ).length;

		if ( botCount <= 0 ) {
			this.logger.error( format( "Game Full: %s", game.id ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: "Game Full!" } );
		}

		this.logger.debug( "<< validateAddBots()" );
		return botCount;
	}

	async validateDealWinDeclaration( input: DeclareDealWinsInput, game: Game, playerId: string ) {
		this.logger.debug( ">> validateDealWinDeclaration()" );

		const deal = await this.prisma.deal.findUnique( {
			where: { id_gameId: { id: input.dealId, gameId: game.id } },
			include: { rounds: true }
		} );

		if ( !deal ) {
			this.logger.error( format( "Deal Not Found: %s", input.dealId ) );
			throw new TRPCError( { code: "NOT_FOUND", message: "Deal Not Found!" } );
		}

		if ( deal.playerOrder[ deal.turnIdx ] !== playerId ) {
			this.logger.error( format( "Not Your Turn: %s", playerId ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: "Not Your Turn!" } );
		}

		this.logger.debug( "<< validateDealWinDeclaration()" );
		return deal;
	}

	async validatePlayCard( input: PlayCardInput, game: Game, playerId: string ) {
		this.logger.debug( ">> validatePlayCard()" );

		const round = await this.prisma.round.findUnique( {
			where: {
				id_dealId_gameId: { id: input.roundId, gameId: game.id, dealId: input.dealId },
				completed: false
			}
		} );

		if ( !round ) {
			this.logger.error( format( "Round Not Found: %s", input.roundId ) );
			throw new TRPCError( { code: "NOT_FOUND", message: "Round Not Found!" } );
		}

		if ( round.playerOrder[ round.turnIdx ] !== playerId ) {
			this.logger.error( format( "Not Your Turn: %s", playerId ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: "Not Your Turn!" } );
		}

		const cardMappings = await this.prisma.cardMapping.findMany( {
			where: { dealId: input.dealId, gameId: game.id, playerId }
		} );

		const hand = CardHand.fromMappings( cardMappings );

		if ( !hand.hasCard( input.cardId ) ) {
			this.logger.error( format( "Card Not Yours: %s", input.cardId ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: "Card Not Yours!" } );
		}

		const cardsPlayedInRound = Object.values( round.cards ).map( PlayingCard.fromId );
		const greatestCardPlayed = getBestCardPlayed( cardsPlayedInRound, game.trumpSuit, round.suit );
		const playableCards = getPlayableCards( hand, game.trumpSuit, greatestCardPlayed, round.suit );

		if ( !playableCards.includes( input.cardId ) ) {
			this.logger.error( format( "Invalid Card: %s", input.cardId ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: "Invalid Card!" } );
		}

		this.logger.debug( "<< validatePlayCard()" );
		return { round, hand, playableCards };
	}
}