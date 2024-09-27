import type { UserAuthInfo } from "@auth/api";
import { Injectable } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { PlayingCard } from "@stairway/cards";
import { TRPCError } from "@trpc/server";
import { format } from "node:util";
import { Messages } from "./literature.constants.ts";
import type { AskCardInput, CallSetInput, JoinGameInput, TransferTurnInput } from "./literature.inputs.ts";
import { LiteraturePrisma } from "./literature.prisma.ts";
import type { CardCounts, Game, PlayerData } from "./literature.types.ts";

@Injectable()
export class LiteratureValidators {

	constructor(
		private readonly prisma: LiteraturePrisma,
		@OgmaLogger( LiteratureValidators ) private readonly logger: OgmaService
	) {}

	async validateJoinGame( input: JoinGameInput, authInfo: UserAuthInfo ) {
		this.logger.debug( ">> validateJoinGame()" );
		const game = await this.prisma.game.findUnique( {
			where: { code: input.code },
			include: { players: true }
		} );

		if ( !game ) {
			this.logger.error( Messages.GAME_NOT_FOUND );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		this.logger.debug( format( "Found Game: %o", game.players.length ) );

		const isUserAlreadyInGame = !!game.players.find( player => player.id === authInfo.id );

		if ( isUserAlreadyInGame ) {
			this.logger.warn( format( "%s GameId: %s", Messages.USER_ALREADY_PART_OF_GAME, game.id ) );
			return { game, isUserAlreadyInGame };
		}

		if ( game.players.length >= game.playerCount ) {
			this.logger.error( format( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, game.id ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS } );
		}

		this.logger.debug( "<< validateJoinGame()" );
		return { game, isUserAlreadyInGame };
	}

	async validateAddBots( game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateAddBotsRequest()" );

		const remainingPlayers = game.playerCount - Object.keys( players ).length;

		if ( remainingPlayers <= 0 ) {
			this.logger.error( format( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, game.id ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS } );
		}

		this.logger.debug( "<< validateAddBotsRequest()" );
		return remainingPlayers;
	}

	async validateCreateTeams( game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateCreateTeamsRequest()" );

		if ( Object.keys( players ).length !== game.playerCount ) {
			this.logger.error( format( "%s GameId: %s", Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS, game.id ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS } );
		}

		this.logger.debug( "<< validateCreateTeamsRequest()" );
	}

	async validateAskCard( input: AskCardInput, game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateAskCardRequest()" );

		const cardMapping = await this.prisma.cardMapping.findUnique( {
			where: { gameId_cardId: { gameId: game.id, cardId: input.card } }
		} );

		if ( !cardMapping ) {
			this.logger.error( format( "Card Not Part of Game! GameId: %s CardId: %s", game.id, input.card ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CARD_NOT_PART_OF_GAME } );
		}

		const askedPlayer = players[ input.from ];
		const playerWithAskedCard = players[ cardMapping.playerId ];

		if ( !askedPlayer ) {
			this.logger.debug( format(
				"%s GameId: %s, PlayerId: %s",
				Messages.PLAYER_NOT_PART_OF_GAME,
				game.id,
				input.from
			) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
		}

		if ( playerWithAskedCard.id === game.currentTurn ) {
			this.logger.debug( format( "%s GameId: %s", Messages.ASKED_CARD_WITH_ASKING_PLAYER, game.id ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ASKED_CARD_WITH_ASKING_PLAYER } );
		}

		if ( players[ game.currentTurn ].teamId === askedPlayer.teamId ) {
			this.logger.debug( format( "%s GameId: %s", Messages.ASKED_PLAYER_FROM_SAME_TEAM, game.id ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ASKED_PLAYER_FROM_SAME_TEAM } );
		}

		this.logger.debug( "<< validateAskCardRequest()" );
		return { askedPlayer, playerWithAskedCard };
	}

	async validateCallSet( input: CallSetInput, game: Game, players: PlayerData ) {
		this.logger.debug( ">> validateCallSetRequest()" );

		const cardMappings = await this.prisma.cardMapping.findMany( {
			where: { gameId: game.id, cardId: { in: Object.keys( input.data ) } }
		} );

		const calledCards = Object.keys( input.data ).map( PlayingCard.fromId );
		const cardSets = new Set( calledCards.map( card => card.set ) );

		const calledPlayers = Array.from( new Set( Object.values( input.data ) ) ).map( playerId => {
			const player = players[ playerId ];
			if ( !player ) {
				this.logger.error( format(
					"%s GameId: %s, PlayerId: %s",
					Messages.PLAYER_NOT_PART_OF_GAME,
					game.id,
					playerId
				) );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}
			return player;
		} );

		if ( !Object.values( input.data ).includes( game.currentTurn ) ) {
			this.logger.error( format( "%s UserId: %s", Messages.DIDNT_CALL_OWN_CARDS, game.currentTurn ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.DIDNT_CALL_OWN_CARDS } );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( format( "%s UserId: %s", Messages.MULTIPLE_SETS_CALLED, game.currentTurn ) );
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
			this.logger.error( format(
				"%s UserId: %s, Set: %s",
				Messages.SET_CALLED_WITHOUT_CARDS,
				game.currentTurn,
				calledSet
			) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.SET_CALLED_WITHOUT_CARDS } );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( format( "%s UserId: %s", Messages.SET_CALLED_FROM_MULTIPLE_TEAMS, game.currentTurn ) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.SET_CALLED_FROM_MULTIPLE_TEAMS } );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error( format(
				"%s UserId: %s, Set: %s",
				Messages.ALL_CARDS_NOT_CALLED,
				game.currentTurn,
				calledSet
			) );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ALL_CARDS_NOT_CALLED } );
		}

		this.logger.debug( "<< validateCallSetRequest()" );
		return { correctCall, calledSet };
	}

	async validateTransferTurn( input: TransferTurnInput, game: Game, players: PlayerData, cardCounts: CardCounts ) {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		const lastMove = await this.prisma.call.findUnique( { where: { id: game.lastMoveId } } );
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