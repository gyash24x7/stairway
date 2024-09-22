import type { UserAuthInfo } from "@auth/api";
import { Injectable } from "@nestjs/common";
import { LoggerFactory } from "@shared/api";
import { PlayingCard } from "@stairway/cards";
import { TRPCError } from "@trpc/server";
import { Messages } from "./literature.constants.ts";
import type { AskCardInput, CallSetInput, JoinGameInput, TransferTurnInput } from "./literature.inputs.ts";
import { LiteratureRepository } from "./literature.repository.ts";
import type { CardCounts, Game, PlayerData } from "./literature.types.ts";

@Injectable()
export class LiteratureValidators {

	private readonly logger = LoggerFactory.getLogger( LiteratureValidators );

	constructor( private readonly repository: LiteratureRepository ) {}

	async validateJoinGame( input: JoinGameInput, authInfo: UserAuthInfo ) {
		this.logger.debug( ">> validateJoinGame()" );
		const game = await this.repository.getGameByCode( input.code );

		if ( !game ) {
			this.logger.error( Messages.GAME_NOT_FOUND );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		this.logger.debug( "Found Game: %o", game.players.length );

		const isUserAlreadyInGame = !!game.players.find( player => player.id === authInfo.id );

		if ( isUserAlreadyInGame ) {
			this.logger.warn( "%s GameId: %s", Messages.USER_ALREADY_PART_OF_GAME, game.id );
			return { game, isUserAlreadyInGame };
		}

		if ( game.players.length >= game.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, game.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS } );
		}

		this.logger.debug( "<< validateJoinGame()" );
		return { game, isUserAlreadyInGame };
	}

	async validateAddBots( game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateAddBotsRequest()" );

		const remainingPlayers = game.playerCount - Object.keys( players ).length;

		if ( remainingPlayers <= 0 ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, game.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS } );
		}

		this.logger.debug( "<< validateAddBotsRequest()" );
		return remainingPlayers;
	}

	async validateCreateTeams( game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateCreateTeamsRequest()" );

		if ( Object.keys( players ).length !== game.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS, game.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS } );
		}

		this.logger.debug( "<< validateCreateTeamsRequest()" );
	}

	async validateAskCard( input: AskCardInput, game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateAskCardRequest()" );

		const cardMapping = await this.repository.getCardMappingForCard( game.id, input.card );

		if ( !cardMapping ) {
			this.logger.error( "Card Not Part of Game! GameId: %s CardId: %s", game.id, input.card );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CARD_NOT_PART_OF_GAME } );
		}

		const askedPlayer = players[ input.from ];
		const playerWithAskedCard = players[ cardMapping.playerId ];

		if ( !askedPlayer ) {
			this.logger.debug(
				"%s GameId: %s, PlayerId: %s",
				Messages.PLAYER_NOT_PART_OF_GAME,
				game.id,
				input.from
			);
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
		}

		if ( playerWithAskedCard.id === game.currentTurn ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_CARD_WITH_ASKING_PLAYER, game.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ASKED_CARD_WITH_ASKING_PLAYER } );
		}

		if ( players[ game.currentTurn ].teamId === askedPlayer.teamId ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_PLAYER_FROM_SAME_TEAM, game.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ASKED_PLAYER_FROM_SAME_TEAM } );
		}

		this.logger.debug( "<< validateAskCardRequest()" );
		return { askedPlayer, playerWithAskedCard };
	}

	async validateCallSet( input: CallSetInput, game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateCallSetRequest()" );

		const cardMappings = await this.repository.getCardMappingsForCards( game.id, Object.keys( input.data ) );
		const calledCards = Object.keys( input.data ).map( PlayingCard.fromId );
		const cardSets = new Set( calledCards.map( card => card.set ) );

		const calledPlayers = Array.from( new Set( Object.values( input.data ) ) ).map( playerId => {
			const player = players[ playerId ];
			if ( !player ) {
				this.logger.error(
					"%s GameId: %s, PlayerId: %s",
					Messages.PLAYER_NOT_PART_OF_GAME,
					game.id,
					playerId
				);
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}
			return player;
		} );

		if ( !Object.values( input.data ).includes( game.currentTurn ) ) {
			this.logger.error( "%s UserId: %s", Messages.DIDNT_CALL_OWN_CARDS, game.currentTurn );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.DIDNT_CALL_OWN_CARDS } );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.MULTIPLE_SETS_CALLED, game.currentTurn );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.MULTIPLE_SETS_CALLED } );
		}

		const [ calledSet ] = cardSets;
		const correctCall: Record<string, string> = {};
		let isCardSetWithCallingPlayer = false;

		cardMappings.forEach( ( { cardId, playerId } ) => {
			const card = PlayingCard.fromId( cardId );
			if ( card.set === calledSet ) {
				correctCall[ cardId ] = playerId;
				if ( playerId === game.currentTurn ) {
					isCardSetWithCallingPlayer = true;
				}
			}
		} );

		if ( !isCardSetWithCallingPlayer ) {
			this.logger.error(
				"%s UserId: %s, Set: %s",
				Messages.SET_CALLED_WITHOUT_CARDS,
				game.currentTurn,
				calledSet
			);
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.SET_CALLED_WITHOUT_CARDS } );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.SET_CALLED_FROM_MULTIPLE_TEAMS, game.currentTurn );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.SET_CALLED_FROM_MULTIPLE_TEAMS } );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.ALL_CARDS_NOT_CALLED, game.currentTurn, calledSet );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ALL_CARDS_NOT_CALLED } );
		}

		this.logger.debug( "<< validateCallSetRequest()" );
		return { correctCall, calledSet };
	}

	async validateTransferTurn( input: TransferTurnInput, game: Game, players: PlayerData, cardCounts: CardCounts ) {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		const lastMove = await this.repository.getCallMove( game.lastMoveId );
		if ( !lastMove ) {
			this.logger.error( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.TRANSFER_AFTER_SUCCESSFUL_CALL } );
		}

		const transferringPlayer = players[ game.currentTurn ];
		const receivingPlayer = players[ input.transferTo ];

		if ( !receivingPlayer ) {
			this.logger.error( Messages.PLAYER_NOT_PART_OF_GAME );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
		}

		if ( cardCounts[ input.transferTo ] === 0 ) {
			this.logger.error( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.NO_CARDS_WITH_RECEIVING_PLAYER } );
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( Messages.TRANSFER_TO_OPPONENT_TEAM );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.TRANSFER_TO_OPPONENT_TEAM } );
		}

		this.logger.debug( "<< validateTransferTurnRequest()" );
		return { transferringPlayer, receivingPlayer };
	}
}