import { Body, Controller, Get, NotFoundException, Post, Put, UseGuards } from "@nestjs/common";
import { Log, LoggerFactory } from "@s2h/utils";
import {
	AskCardInput,
	AskMoveData,
	CallMoveData,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	LiteratureGame,
	LiteratureGameHand,
	LiteratureGameStatus,
	LiteratureMove,
	LiteraturePlayer,
	LiteratureTeam,
	TransferChanceInput
} from "@literature/data";
import { AuthGuard, AuthInfo } from "@auth/core";
import { RequireActiveGameGuard, RequireGameGuard, RequireHandsGuard, RequirePlayerGuard } from "../guards";
import { ActiveGame, ActiveGameHands, ActivePlayer } from "../decorators";
import { CardHand, PlayingCard } from "@s2h/cards";
import type { UserAuthInfo } from "@auth/data";
import { ObjectId } from "mongodb";
import { LiteratureService } from "../services";

@Controller( "literature/games" )
export class GamesController {
	private readonly logger = LoggerFactory.getLogger( GamesController );

	constructor( private readonly literatureService: LiteratureService ) {}

	@Post()
	@Log( GamesController )
	@UseGuards( AuthGuard )
	async createGame( @Body() input: CreateGameInput, @AuthInfo() authInfo: UserAuthInfo ): Promise<string> {
		const id = new ObjectId();
		const game = LiteratureGame.createNew( id.toHexString(), input.playerCount || 2, authInfo );
		const player = LiteraturePlayer.createFromAuthInfo( authInfo );
		game.addPlayers( player );
		await this.literatureService.saveGame( game );
		return id.toHexString();
	}


	@Post( "join" )
	@Log( GamesController )
	@UseGuards( AuthGuard )
	async joinGame( @Body() input: JoinGameInput, @AuthInfo() authInfo: UserAuthInfo ) {
		const game = await this.literatureService.findGameByCode( input.code );

		if ( game.playerIds.length >= game.playerCount ) {
			throw new NotFoundException();
		}

		if ( game.isUserAlreadyInGame( authInfo.id ) ) {
			return game;
		}

		game.addPlayers( LiteraturePlayer.createFromAuthInfo( authInfo ) );

		game.status = game.playerIds.length === game.playerCount
			? LiteratureGameStatus.PLAYERS_READY
			: LiteratureGameStatus.CREATED;

		await this.literatureService.saveGame( game );
		return game.id;
	}


	@Put( ":id/create-teams" )
	@Log( GamesController )
	@UseGuards( AuthGuard, RequireGameGuard, RequirePlayerGuard )
	async createTeams( @Body() input: CreateTeamsInput, @ActiveGame() currentGame: LiteratureGame ) {
		if ( currentGame.status !== LiteratureGameStatus.PLAYERS_READY ) {
			throw new NotFoundException();
		}

		if ( currentGame.playerIds.length !== currentGame.playerCount ) {
			throw new NotFoundException();
		}

		const teams = Object.keys( input.data )
			.map( name => LiteratureTeam.create( new ObjectId().toHexString(), name, input.data[ name ] ) );

		currentGame.addTeams( teams );
		currentGame.status = LiteratureGameStatus.TEAMS_CREATED;

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}


	@Put( ":id/start" )
	@Log( GamesController )
	@UseGuards( AuthGuard, RequireGameGuard, RequirePlayerGuard )
	async startGame( @ActiveGame() currentGame: LiteratureGame ) {
		if ( currentGame!.status !== LiteratureGameStatus.TEAMS_CREATED ) {
			throw new NotFoundException();
		}

		const hands = currentGame.dealCards();
		await Promise.all(
			Object.keys( hands ).map( playerId => {
				const id = new ObjectId().toHexString();
				const hand = LiteratureGameHand.create( id, playerId, currentGame.id, hands[ playerId ] );
				return this.literatureService.saveHand( hand );
			} )
		);
		currentGame.status = LiteratureGameStatus.IN_PROGRESS;

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}


	@Put( ":id/ask-card" )
	@Log( GamesController )
	@UseGuards( AuthGuard, RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async askCard(
		@Body() input: AskCardInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>,
		@ActivePlayer() currentPlayer: LiteraturePlayer
	) {
		const askingPlayer = currentGame.players[ currentPlayer.id ];
		const askedPlayer = currentGame.players[ input.askedFrom ];
		const askingPlayerHand = currentGameHands[ askingPlayer.id ];

		if ( !askedPlayer ) {
			throw new NotFoundException();
		}

		if ( askingPlayer.teamId! === askedPlayer.teamId! ) {
			throw new NotFoundException();
		}

		const askedCard = PlayingCard.from( input.askedFor );
		if ( askingPlayerHand.contains( askedCard ) ) {
			throw new NotFoundException();
		}

		const askData = new AskMoveData( { from: input.askedFrom, by: currentPlayer.id, card: input.askedFor } );
		const updatedHands = currentGame.executeAskMove( askData, currentGameHands );
		const id = new ObjectId().toHexString();
		const move = LiteratureMove.buildAskMove( id, currentGame.id, askData, !!updatedHands );

		await this.literatureService.saveMove( move );

		if ( !!updatedHands ) {
			await Promise.all( Object.keys( updatedHands ).map( playerId =>
				this.literatureService.updateHand( currentGame.id, playerId, updatedHands[ playerId ] )
			) );
		}

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}


	@Put( ":id/call-set" )
	@UseGuards( AuthGuard, RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async callSet(
		@Body() { data }: CallSetInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActivePlayer() callingPlayer: LiteraturePlayer,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>
	) {
		const calledCards = Object.values( data ).flat().map( PlayingCard.from );
		const calledCardIds = new Set( calledCards.map( card => card.cardId ) );
		const cardSets = new Set( calledCards.map( card => card.cardSet ) );

		const callingPlayerHand = currentGameHands[ callingPlayer.id ];
		const calledPlayers = Object.keys( data ).map( playerId => {
			const player = currentGame.players[ playerId ];
			if ( !player ) {
				this.logger.trace( "Input: %o", { data } );
				this.logger.trace( "Game: %o", currentGame );
				this.logger.error(
					"Called Player Not Found in Game! PlayerId: %s, UserId: %s",
					playerId,
					callingPlayer.id
				);
				throw new NotFoundException();
			}
			return player;
		} );

		if ( !Object.keys( data ).includes( callingPlayer.id ) || data[ callingPlayer.id ].length === 0 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Calling Player did not call own cards! UserId: %s", callingPlayer.id );
			throw new NotFoundException();
		}

		if ( calledCardIds.size !== calledCards.length ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Same Cards called for multiple players! UserId: %s", callingPlayer.id );
			throw new NotFoundException();
		}

		if ( cardSets.size !== 1 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Cards Called from multiple sets! UserId: %s", callingPlayer.id );
			throw new NotFoundException();
		}

		const [ callingSet ] = cardSets;

		if ( !callingPlayerHand.cardSetsInHand.includes( callingSet ) ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error(
				"Set called without cards from that set! UserId: %s, Set: %s",
				callingPlayer.id,
				callingSet
			);
			throw new NotFoundException();
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Cards Called for players from multiple teams! UserId: %s", callingPlayer.id );
			throw new NotFoundException();
		}

		if ( calledCards.length !== 6 ) {
			this.logger.trace( "Input: %o", { data } );
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error(
				"All Cards not called for the set! UserId: %s, Set: %s",
				callingPlayer.id,
				callingSet
			);
			throw new NotFoundException();
		}

		const actualCall: Record<string, PlayingCard[]> = {};
		Object.keys( data ).forEach( playerId => {
			actualCall[ playerId ] = data[ playerId ].map( PlayingCard.from );
		} );

		const callData: CallMoveData = {
			by: callingPlayer.id,
			cardSet: callingSet,
			actualCall,
			correctCall: {}
		};

		const success = currentGame.executeCallMove( callData, currentGameHands );
		Object.keys( currentGameHands ).map( playerId => {
			const removedCards = currentGameHands[ playerId ].removeCardsOfSet( callingSet );
			if ( removedCards.length !== 0 ) {
				callData.correctCall[ playerId ] = removedCards;
			}
		} );

		const moveId = new ObjectId().toHexString();
		const move = LiteratureMove.buildCallMove( moveId, currentGame.id, callData, success );
		await this.literatureService.saveMove( move );

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}


	@Put( ":id/transfer-chance" )
	@Log( GamesController )
	@UseGuards( AuthGuard, RequireGameGuard, RequirePlayerGuard, RequireActiveGameGuard, RequireHandsGuard )
	async transferChance(
		@Body() input: TransferChanceInput,
		@ActiveGame() currentGame: LiteratureGame,
		@ActivePlayer() givingPlayer: LiteraturePlayer,
		@ActiveGameHands() currentGameHands: Record<string, CardHand>
	) {
		const lastMove = await this.literatureService.findLastCallMove( currentGame.id );

		if ( !lastMove?.success ) {
			this.logger.error( "Chance can only be transferred after successful call!" );
			throw new NotFoundException();
		}

		const receivingPlayer = currentGame.players[ input.transferTo ];
		const receivingPlayerHand = currentGameHands[ receivingPlayer.id ];

		if ( !receivingPlayer ) {
			this.logger.error( "Cannot transfer chance to unknown player!" );
			throw new NotFoundException();
		}

		if ( receivingPlayerHand.length === 0 ) {
			this.logger.error( "Chance can only be transferred to a player with cards!" );
			throw new NotFoundException();
		}

		if ( receivingPlayer.teamId !== givingPlayer.teamId ) {
			this.logger.error( "Chance can only be transferred to member of your team!" );
			throw new NotFoundException();
		}

		currentGame.executeChanceTransferMove( { to: input.transferTo, from: givingPlayer.id } );

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}


	@Get( ":id" )
	@Log( GamesController )
	@UseGuards( AuthGuard, RequireGameGuard, RequirePlayerGuard )
	async getGame( @ActiveGame() currentGame: LiteratureGame ) {
		return currentGame;
	}
}