import { Injectable } from "@nestjs/common";
import { type AuthContext, LoggerFactory } from "@shared/api";
import { CardDeck, CardHand, CardRank, CardSet, cardSetMap, PlayingCard, shuffle } from "@stairway/cards";
import { uniqueNamesGenerator } from "unique-names-generator";
import { LiteratureBotService } from "./literature.bot.service.ts";
import { Constants, GameEvents, namesConfig } from "./literature.constants.ts";
import { LiteratureGateway } from "./literature.gateway.ts";
import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	TransferTurnInput
} from "./literature.inputs.ts";
import { LiteratureRepository } from "./literature.repository.ts";
import type {
	CardCounts,
	CardLocation,
	CardMapping,
	LiteratureContext,
	PlayerData,
	TeamData
} from "./literature.types.ts";
import { LiteratureValidators } from "./literature.validators.ts";

@Injectable()
export class LiteratureMutations {

	private readonly logger = LoggerFactory.getLogger( LiteratureMutations );

	constructor(
		private readonly repository: LiteratureRepository,
		private readonly validators: LiteratureValidators,
		private readonly botService: LiteratureBotService,
		private readonly gateway: LiteratureGateway
	) {}

	async createGame( { playerCount }: CreateGameInput, { authInfo: { id, name, avatar } }: AuthContext ) {
		this.logger.log( ">> createGame()" );

		const game = await this.repository.createGame( { playerCount, currentTurn: id } );
		const player = await this.repository.createPlayer( { id, name, gameId: game.id, avatar } );

		this.logger.debug( "<< createGame()" );
		return { ...game, players: [ player ] };
	}

	async joinGame( input: JoinGameInput, { authInfo }: AuthContext ) {
		this.logger.debug( ">> joinGame()" );

		const { game, isUserAlreadyInGame } = await this.validators.validateJoinGame( input, authInfo );

		if ( isUserAlreadyInGame ) {
			return game;
		}

		const newPlayer = await this.repository.createPlayer( {
			id: authInfo.id,
			name: authInfo.name,
			gameId: game.id
		} );

		if ( game.playerCount === game.players.length + 1 ) {
			await this.repository.updateGameStatus( game.id, "PLAYERS_READY" );
			this.gateway.publishGameEvent( game.id, GameEvents.STATUS_UPDATED, "PLAYERS_READY" );
		}

		this.gateway.publishGameEvent( game.id, GameEvents.PLAYER_JOINED, newPlayer );

		this.logger.debug( "<< joinGame()" );
		return game;
	}

	async addBots( { game, players }: LiteratureContext ) {
		this.logger.debug( ">> addBots()" );
		const botData: PlayerData = {};

		const botCount = await this.validators.validateAddBots( game, players );

		for ( let i = 0; i < botCount; i++ ) {
			const bot = await this.repository.createPlayer( {
				gameId: game.id,
				name: uniqueNamesGenerator( namesConfig ),
				isBot: true
			} );

			botData[ bot.id ] = bot;
			this.gateway.publishGameEvent( game.id, GameEvents.PLAYER_JOINED, bot );
		}

		await this.repository.updateGameStatus( game.id, "PLAYERS_READY" );
		this.gateway.publishGameEvent( game.id, GameEvents.STATUS_UPDATED, "PLAYERS_READY" );

		this.logger.debug( "<< addBots()" );
		return botData;
	}

	async createTeams( input: CreateTeamsInput, { game, players }: LiteratureContext ) {
		this.logger.debug( ">> createTeams()" );

		await this.validators.validateCreateTeams( game, players );

		const [ teamA, teamB ] = await this.repository.createTeams(
			Object.keys( input.data ).map( name => {
				return { name, gameId: game.id, memberIds: input.data[ name ] };
			} )
		);

		const teamData: TeamData = { [ teamA.id ]: teamA, [ teamB.id ]: teamB };
		await this.repository.assignTeamsToPlayers( teamData );

		await this.repository.updateGameStatus( game.id, "TEAMS_CREATED" );
		this.gateway.publishGameEvent( game.id, GameEvents.STATUS_UPDATED, "TEAMS_CREATED" );
		this.gateway.publishGameEvent( game.id, GameEvents.TEAMS_CREATED, teamData );

		this.logger.debug( "<< createTeams()" );
		return teamData;
	}

	async startGame( { game, players }: LiteratureContext ) {
		this.logger.debug( ">> startGame()" );

		await this.repository.updateGameStatus( game.id, "IN_PROGRESS" );

		const deck = new CardDeck();
		deck.removeCardsOfRank( CardRank.SEVEN );

		const playerIds = Object.keys( players );
		const hands = deck.generateHandsFromCards( game.playerCount );

		const cardLocations: CardLocation[] = [];
		const cardMappings: CardMapping[] = [];
		const cardCounts: CardCounts = {};

		playerIds.forEach( ( playerId, index ) => {
			const cardsWithPlayer = hands[ index ].cardIds;
			cardCounts[ playerId ] = 48 / game.playerCount;

			cardsWithPlayer.forEach( cardId => {
				cardMappings.push( { cardId, playerId, gameId: game.id } );
			} );

			const otherPlayerIds = playerIds.filter( id => id !== playerId );

			const cardLocationsForPlayer = deck.cards.map( c => {
				if ( cardsWithPlayer.includes( c.id ) ) {
					return { gameId: game.id, cardId: c.id, playerId, playerIds: [ playerId ], weight: 0 };
				}

				const weight = Constants.MAX_ASK_WEIGHT / otherPlayerIds.length;
				return { gameId: game.id, cardId: c.id, playerId, playerIds: otherPlayerIds, weight };
			} );

			cardLocations.push( ...cardLocationsForPlayer );
		} );

		await this.repository.createCardMappings( cardMappings );
		await this.repository.createCardLocations( cardLocations );

		this.gateway.publishGameEvent( game.id, GameEvents.CARD_COUNT_UPDATED, cardCounts );
		this.logger.debug( "Published CardCountUpdatedEvent!" );

		playerIds.forEach( ( playerId, index ) => {
			this.gateway.publishPlayerEvent(
				game.id,
				playerId,
				GameEvents.CARDS_DEALT,
				hands[ index ].serialize()
			);
		} );

		this.gateway.publishGameEvent( game.id, GameEvents.STATUS_UPDATED, "IN_PROGRESS" );
		this.logger.debug( "Published StatusUpdatedEvent!" );

		this.logger.debug( "<< startGame()" );
	}

	async askCard( input: AskCardInput, { game, players, cardCounts }: LiteratureContext ) {
		this.logger.debug( ">> askCard()" );

		const { playerWithAskedCard, askedPlayer } = await this.validators.validateAskCard( input, game, players );
		const askedCard = PlayingCard.fromId( input.card );
		const currentPlayer = players[ game.currentTurn ];

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ currentPlayer.name } asked ${ askedPlayer.name } for ${ askedCard.displayString } and ${ receivedString }`;

		const ask = await this.repository.createAsk( {
			playerId: currentPlayer.id,
			gameId: game.id,
			success: moveSuccess,
			description,
			cardId: input.card,
			askedFrom: input.from
		} );

		const nextTurn = !ask.success ? ask.askedFrom : ask.playerId;
		if ( nextTurn !== game.currentTurn ) {
			await this.repository.updateCurrentTurn( ask.gameId, nextTurn );
			this.gateway.publishGameEvent( game.id, GameEvents.TURN_UPDATED, nextTurn );
			this.logger.debug( "Published TurnUpdatedEvent!" );
		}

		if ( ask.success ) {
			await this.repository.updateCardMapping( ask.cardId, ask.gameId, ask.playerId );
			cardCounts[ ask.playerId ]++;
			cardCounts[ ask.askedFrom ]--;

			this.gateway.publishGameEvent( game.id, GameEvents.CARD_COUNT_UPDATED, cardCounts );
			this.logger.debug( "Published CardCountUpdatedEvent!" );
		}

		const cardLocations = await this.repository.getCardLocationsForCard( game.id, ask.cardId );

		for ( const cardLocation of cardLocations ) {
			if ( ask.success ) {
				cardLocation.weight = ask.playerId === cardLocation.playerId ? 0 : Constants.MAX_ASK_WEIGHT;
				cardLocation.playerIds = [ ask.playerId ];
			} else {
				cardLocation.playerIds = cardLocation.playerIds.filter(
					p => p !== ask.playerId && p !== ask.askedFrom
				);
				cardLocation.weight = Constants.MAX_ASK_WEIGHT / cardLocation.playerIds.length;
			}
		}

		await this.repository.updateCardLocations( cardLocations );
		await this.repository.updateLastMove( game.id, ask.id );
		this.gateway.publishGameEvent( game.id, GameEvents.CARD_ASKED, ask );

		this.logger.debug( "<< askCard()" );
	}

	async callSet( input: CallSetInput, { game, players, teams, cardCounts }: LiteratureContext ) {
		this.logger.debug( ">> callSet()" );

		const { correctCall, calledSet } = await this.validators.validateCallSet( input, game, players );
		const callingPlayer = players[ game.currentTurn ]!;

		let success = true;
		let successString = "correctly!";

		const cardsOfCallingSet = cardSetMap[ calledSet ].map( PlayingCard.from );
		for ( const card of cardsOfCallingSet ) {
			if ( correctCall[ card.id ] !== input.data[ card.id ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		const call = await this.repository.createCall( {
			gameId: game.id,
			playerId: callingPlayer.id,
			success,
			description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
			cardSet: calledSet,
			actualCall: input.data,
			correctCall
		} );

		let winningTeamId = callingPlayer.teamId!;

		if ( !success ) {
			const [ player ] = Object.values( players ).filter( player => player.teamId !== winningTeamId );
			winningTeamId = player.teamId!;
		}

		teams[ winningTeamId ].setsWon.push( calledSet );
		teams[ winningTeamId ].score++;
		await this.repository.updateTeamScore(
			winningTeamId,
			teams[ winningTeamId ].score,
			teams[ winningTeamId ].setsWon
		);

		const scoreUpdate = {
			teamId: teams[ winningTeamId ].id,
			score: teams[ winningTeamId ].score,
			setWon: calledSet
		};

		const setsCompleted: CardSet[] = [];
		Object.values( teams ).forEach( team => {
			setsCompleted.push( ...team.setsWon as CardSet[] );
		} );

		this.gateway.publishGameEvent( game.id, GameEvents.SCORE_UPDATED, scoreUpdate );
		this.logger.debug( "SetsCompleted: %o", setsCompleted );

		const isLastSet = setsCompleted.length === 8;
		if ( isLastSet ) {
			await this.repository.updateGameStatus( game.id, "COMPLETED" );
			this.gateway.publishGameEvent( game.id, GameEvents.GAME_COMPLETED, game.id );

		} else {

			let nextTurn: string;
			const playersWithCards = shuffle( Object.values( players ) )
				.filter( player => cardCounts[ player.id ] !== 0 );

			const oppositeTeamPlayersWithCards = playersWithCards.filter( p => p.teamId !== callingPlayer.teamId );
			const teamPlayersWithCards = playersWithCards.filter( p => p.teamId === callingPlayer.teamId );

			if ( success ) {
				if ( cardCounts[ callingPlayer.id ] !== 0 ) {
					nextTurn = callingPlayer.id;
				} else {
					if ( teamPlayersWithCards.length !== 0 ) {
						nextTurn = teamPlayersWithCards[ 0 ].id;
					} else {
						nextTurn = oppositeTeamPlayersWithCards[ 0 ].id;
					}
				}
			} else {
				if ( oppositeTeamPlayersWithCards.length !== 0 ) {
					nextTurn = oppositeTeamPlayersWithCards[ 0 ].id;
				} else {
					nextTurn = callingPlayer.id;
				}
			}

			if ( nextTurn !== game.currentTurn ) {
				await this.repository.updateCurrentTurn( game.id, nextTurn );
				this.gateway.publishGameEvent( game.id, GameEvents.TURN_UPDATED, nextTurn );
				this.logger.debug( "Published TurnUpdatedEvent!" );
			}
		}

		const calledCards = Object.keys( correctCall );
		await this.repository.deleteCardMappings( game.id, calledCards );
		await this.repository.deleteCardLocationForCards( game.id, calledCards );

		Object.values( correctCall ).forEach( playerId => {
			cardCounts[ playerId ]--;
		} );

		await this.repository.updateLastMove( game.id, call.id );
		this.gateway.publishGameEvent( game.id, GameEvents.SET_CALLED, call );
		this.gateway.publishGameEvent( game.id, GameEvents.CARD_COUNT_UPDATED, cardCounts );

		this.logger.debug( "<< callSet()" );
	}

	async transferTurn( input: TransferTurnInput, { game, players, cardCounts }: LiteratureContext ) {
		this.logger.debug( ">> transferTurn()" );

		const { transferringPlayer, receivingPlayer } = await this.validators.validateTransferTurn(
			input, game, players, cardCounts
		);

		const transfer = await this.repository.createTransfer( {
			gameId: game.id,
			playerId: transferringPlayer.id,
			success: true,
			description: `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`,
			transferTo: input.transferTo
		} );

		await this.repository.updateLastMove( game.id, transfer.id );
		await this.repository.updateCurrentTurn( game.id, input.transferTo );
		this.gateway.publishGameEvent( game.id, GameEvents.TURN_UPDATED, input.transferTo );
		this.logger.debug( "Published TurnUpdatedEvent!" );

		this.gateway.publishGameEvent( game.id, GameEvents.TURN_TRANSFERRED, transfer );

		this.logger.debug( "<< transferTurn()" );
	}

	async executeBotMove( ctx: LiteratureContext ) {
		this.logger.debug( ">> executeBotMove()" );

		const { game, players, cardCounts } = ctx;

		const cardLocations = await this.repository.getCardLocationsForPlayer( game.id, game.currentTurn );
		const cardMappings = await this.repository.getCardMappingsForPlayer( game.id, game.currentTurn );
		const lastCall = await this.repository.getCallMove( game.lastMoveId );

		const hand = CardHand.fromMappings( cardMappings );
		const cardSets = this.botService.suggestCardSets( cardLocations, hand );

		if ( !!lastCall && lastCall.success && lastCall.playerId === game.currentTurn ) {
			this.logger.info( "Last Move was a successful call! Can transfer chance!" );
			const transfers = this.botService.suggestTransfer( game, players, cardCounts );

			if ( transfers.length > 0 ) {

				await this.transferTurn( { transferTo: transfers[ 0 ].transferTo, gameId: game.id }, ctx );
				this.logger.debug( "<< executeBotMove()" );
				return;
			}
		}

		const calls = this.botService.suggestCalls( game, players, cardCounts, cardSets, cardLocations, hand );

		if ( calls.length > 0 ) {

			await this.callSet( { gameId: game.id, data: calls[ 0 ].callData }, ctx );
			this.logger.debug( "<< executeBotMove()" );
			return;
		}

		const asks = this.botService.suggestAsks( game, players, cardCounts, cardSets, cardLocations, hand );

		if ( asks.length === 0 ) {
			this.logger.error( "No Valid Move Found!" );
		}

		const [ bestAsk ] = asks;
		await this.askCard( { from: bestAsk.playerId, card: bestAsk.cardId, gameId: game.id }, ctx );

		this.logger.debug( "<< executeBotMove()" );
	}
}