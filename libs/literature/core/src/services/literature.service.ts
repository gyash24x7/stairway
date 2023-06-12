import { Controller, UseGuards } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import {
	LiteratureGame,
	LiteratureGameHand,
	LiteratureGameStatus,
	LiteratureMove,
	LiteratureMoveType,
	LiteraturePlayer
} from "../models";
import { AuthGuard, AuthInfo, type UserAuthInfo } from "@s2h/auth";
import {
	AskCardInput,
	CallSetInput,
	ChanceTransferInput,
	CreateGameInput,
	CreateTeamsInput,
	GetGameInput,
	IPlayerCallData,
	JoinGameInput,
	StartGameInput
} from "../inputs";
import { Database, LoggerFactory } from "@s2h/utils";
import type { Db } from "../types";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { RequireActiveGameGuard, RequireGameGuard, RequireHandsGuard, RequirePlayerGuard } from "../guards";
import { ActiveGame, ActiveGameHands, ActivePlayer } from "../decorators";
import { createId } from "@paralleldrive/cuid2";
import { CardHand, PlayingCard } from "@s2h/cards";

@Controller()
@UseGuards( AuthGuard )
export class LiteratureService {
	private readonly logger = LoggerFactory.getLogger( LiteratureService );

	constructor( @Database() private readonly db: Db ) {}

	@GrpcMethod()
	async createGame( input: CreateGameInput, @AuthInfo() authInfo: UserAuthInfo ) {
		const game = LiteratureGame.create( input.playerCount || 2, authInfo );
		const player = LiteraturePlayer.create( authInfo );
		game.addPlayers( player );
		await this.db.games().insertOne( game.serialize() );
		return game;
	}

	@GrpcMethod()
	async joinGame( input: JoinGameInput, @AuthInfo() authInfo: UserAuthInfo ) {
		const gameData = await this.db.games().findOne( { code: input.code } );

		if ( !gameData ) {
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		const game = LiteratureGame.from( gameData );

		if ( game.playerIds.length >= game.playerCount ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_CAPACITY_FULL } );
		}

		if ( game.isUserAlreadyInGame( authInfo.id ) ) {
			return game;
		}

		game.addPlayers( LiteraturePlayer.create( authInfo ) );

		game.status = game.playerIds.length === game.playerCount
			? LiteratureGameStatus.PLAYERS_READY
			: LiteratureGameStatus.CREATED;

		await this.db.games().updateOne( { id: game.id }, game.serialize() );
		return game;
	}

	@GrpcMethod()
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	@GrpcMethod()
	async createTeams( input: CreateTeamsInput, @ActiveGame() currentGame: LiteratureGame ) {
		if ( currentGame.status !== LiteratureGameStatus.PLAYERS_READY ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
		}

		if ( currentGame.playerIds.length !== currentGame.playerCount ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.NOT_ENOUGH_PLAYERS } );
		}

		currentGame.createTeams( input.data );
		currentGame.status = LiteratureGameStatus.TEAMS_CREATED;

		await this.db.games().updateOne( { id: currentGame.id }, currentGame.serialize() );
		return currentGame;
	}

	@GrpcMethod()
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	async startGame( _input: StartGameInput, @ActiveGame() currentGame: LiteratureGame ) {
		if ( currentGame!.status !== LiteratureGameStatus.TEAMS_CREATED ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
		}

		const hands = currentGame.dealCards();
		await Promise.all(
			Object.keys( hands ).map( playerId => {
				this.db.hands().insertOne(
					LiteratureGameHand.from( {
							gameId: currentGame.id,
							playerId,
							hand: hands[ playerId ],
							id: createId()
						}
					)
				);
			} )
		);
		currentGame.status = LiteratureGameStatus.IN_PROGRESS;

		await this.db.games().updateOne( { id: currentGame.id }, currentGame.serialize() );
		return currentGame;
	}

	@GrpcMethod()
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async askCard(
		input: AskCardInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>,
		@ActivePlayer() currentPlayer: LiteraturePlayer
	) {
		const askingPlayer = currentGame.players[ currentPlayer.id ];
		const askedPlayer = currentGame.players[ input.askedFrom ];
		const askingPlayerHand = CardHand.from( currentGameHands![ askingPlayer.id ] );

		if ( !askedPlayer ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
		}

		if ( askingPlayer.teamId! === askedPlayer.teamId! ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_ASK_FROM_YOUR_TEAM } );
		}

		const askedCard = PlayingCard.from( input.askedFor );
		if ( askingPlayerHand.contains( askedCard ) ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_ASK_CARD_THAT_YOU_HAVE } );
		}

		const askData = { by: currentPlayer.id, from: input.askedFrom, card: input.askedFor };
		const updatedHands = currentGame.executeAskMove( askData, currentGameHands );
		const move = LiteratureMove.createAskMove( currentGame.id, askData, !!updatedHands );

		await this.db.moves().insertOne( move.serialize() );

		if ( !!updatedHands ) {
			await Promise.all(
				Object.keys( updatedHands ).map( playerId => this.db.hands().updateOne(
					{ gameId: currentGame.id, playerId },
					updatedHands[ playerId ].serialize()
				) )
			);
		}

		await this.db.games().updateOne( { id: currentGame.id }, currentGame.serialize() );
		return currentGame;
	}

	@GrpcMethod()
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async callSet(
		{ data, gameId }: CallSetInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActivePlayer() callingPlayer: LiteraturePlayer,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>
	) {
		const calledCards = Object.values( data )
			.flatMap( playerCallData => playerCallData.cards )
			.map( PlayingCard.from );

		const calledCardIds = new Set( calledCards.map( card => card.id ) );
		const cardSets = new Set( calledCards.map( card => card.set ) );

		const callingPlayerHand = currentGameHands[ callingPlayer.id ];
		const calledPlayers = Object.keys( data ).map( playerId => {
			const player = currentGame.players[ playerId ];
			if ( !player ) {
				this.logger.trace( "Input: %o", { data, gameId } );
				this.logger.trace( "Game: %o", currentGame.serialize() );
				this.logger.error(
					"Called Player Not Found in Game! PlayerId: %s, UserId: %s",
					playerId,
					callingPlayer.id
				);
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
			}
			return player;
		} );

		if ( !Object.keys( data ).includes( callingPlayer.id ) || data[ callingPlayer.id ].cards.length === 0 ) {
			this.logger.trace( "Input: %o", { data, gameId } );
			this.logger.trace( "Game: %o", currentGame.serialize() );
			this.logger.error( "Calling Player did not call own cards! UserId: %s", callingPlayer.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_CALL } );
		}

		if ( calledCardIds.size !== calledCards.length ) {
			this.logger.trace( "Input: %o", { data, gameId } );
			this.logger.trace( "Game: %o", currentGame.serialize() );
			this.logger.error( "Same Cards called for multiple players! UserId: %s", callingPlayer.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.DUPLICATES_IN_CALL } );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.trace( "Input: %o", { data, gameId } );
			this.logger.trace( "Game: %o", currentGame.serialize() );
			this.logger.error( "Cards Called from multiple sets! UserId: %s", callingPlayer.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_CARDS_OF_SAME_SET } );
		}

		const [ callingSet ] = cardSets;

		if ( !callingPlayerHand.cardSetsInHand.includes( callingSet ) ) {
			this.logger.trace( "Input: %o", { data, gameId } );
			this.logger.trace( "Game: %o", currentGame.serialize() );
			this.logger.error(
				"Set called without cards from that set! UserId: %s, Set: %s",
				callingPlayer.id,
				callingSet
			);
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_CALL_SET_THAT_YOU_DONT_HAVE } );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.trace( "Input: %o", { data, gameId } );
			this.logger.trace( "Game: %o", currentGame.serialize() );
			this.logger.error( "Cards Called for players from multiple teams! UserId: %s", callingPlayer.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_WITHIN_YOUR_TEAM } );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.trace( "Input: %o", { data, gameId } );
			this.logger.trace( "Game: %o", currentGame.serialize() );
			this.logger.error(
				"All Cards not called for the set! UserId: %s, Set: %s",
				callingPlayer.id,
				callingSet
			);
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_ALL_CARDS } );
		}

		const callData = { by: callingPlayer.id, set: callingSet, data: data };
		const success = currentGame.executeCallMove( callData, currentGameHands );

		const correctCall: Record<string, IPlayerCallData> = {};
		Object.keys( currentGameHands ).map( playerId => {
			const removedCards = currentGameHands[ playerId ].removeCardsOfSet( callingSet );
			if ( removedCards.length !== 0 ) {
				correctCall[ playerId ] = { cards: removedCards };
			}
		} );

		const move = LiteratureMove.createCallMove( currentGame.id, callData, success, correctCall );
		await this.db.moves().insertOne( move.serialize() );

		await this.db.games().updateOne( { id: currentGame.id }, currentGame.serialize() );
		return currentGame;
	}

	@GrpcMethod()
	@UseGuards( RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async chanceTransfer(
		input: ChanceTransferInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActivePlayer() givingPlayer: LiteraturePlayer,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>
	) {
		const lastMove = await this.db.moves().findOne( {
			gameId: currentGame.id,
			moveType: LiteratureMoveType.CALL_SET,
			action: { callData: { by: givingPlayer.id } }
		} );

		if ( !lastMove?.success ) {
			this.logger.error( "Chance can only be transferred after successful call!" );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_CHANCE_TRANSFER } );
		}

		const receivingPlayer = currentGame.players[ input.transferTo ];
		const receivingPlayerHand = currentGameHands[ receivingPlayer.id ];

		if ( !receivingPlayer ) {
			this.logger.error( "Cannot transfer chance to unknown player!" );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
		}

		if ( receivingPlayerHand.length === 0 ) {
			this.logger.error( "Chance can only be transferred to a player with cards!" );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CHANCE_TRANSFER_TO_PLAYER_WITH_CARDS } );
		}

		if ( receivingPlayer.teamId !== givingPlayer.teamId ) {
			this.logger.error( "Chance can only be transferred to member of your team!" );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CHANCE_TRANSFER_TO_SAME_TEAM_PLAYER } );
		}

		currentGame.executeChanceTransferMove( { to: input.transferTo, from: givingPlayer.id } );

		await this.db.games().updateOne( { id: currentGame.id }, currentGame.serialize() );
		return currentGame;
	}

	@GrpcMethod()
	@UseGuards( RequireGameGuard, RequirePlayerGuard )
	async getGame( _input: GetGameInput, @ActiveGame() currentGame: LiteratureGame ) {
		return currentGame;
	}
}