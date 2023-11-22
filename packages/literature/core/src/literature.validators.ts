import {
	AskCardInput,
	CallSetInput,
	CardsData,
	GameData,
	GameStatus,
	JoinGameInput,
	MoveType,
	PlayerSpecificData,
	TransferTurnInput,
	User
} from "@literature/types";
import { getPlayingCardFromId, isCardSetInHand } from "@s2h/cards";
import { HttpException, LoggerFactory, prismaService, PrismaService } from "@s2h/core";
import { Messages } from "./literature.constants";

type MoveValidatorInput<I extends AskCardInput | CallSetInput | TransferTurnInput> = {
	input: I;
	gameData: GameData;
	playerData: PlayerSpecificData;
	cardsData: CardsData;
}

export class LiteratureValidators {

	private readonly logger = LoggerFactory.getLogger( LiteratureValidators );

	constructor( private readonly prisma: PrismaService ) {}

	async joinGame( { input, authUser }: { input: JoinGameInput; authUser: User; } ) {
		this.logger.debug( ">> validateJoinGameRequest()" );

		const game = await this.prisma.literature.game.findUnique( {
			where: { code: input.code },
			include: { players: true }
		} );

		if ( !game ) {
			this.logger.error( Messages.GAME_NOT_FOUND );
			throw new HttpException( 404, Messages.GAME_NOT_FOUND );
		}

		this.logger.debug( "Found Game: %o", game.players.length );

		const isUserAlreadyInGame = !!game.players.find( player => player.id === authUser.id );

		if ( isUserAlreadyInGame ) {
			this.logger.warn( "%s GameId: %s", Messages.USER_ALREADY_PART_OF_GAME, game.id );
			return { game, isUserAlreadyInGame };
		}

		if ( game.players.length >= game.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, game.id );
			throw new HttpException( 400, Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS );
		}

		this.logger.debug( "<< validateJoinGameRequest()" );
		return { game, isUserAlreadyInGame };
	}

	async addBots( gameData: GameData ) {
		this.logger.debug( ">> validateAddBotsRequest()" );

		if ( gameData.status !== GameStatus.CREATED ) {
			this.logger.debug( "Game Present but not in correct status!" );
			throw new HttpException( 400, Messages.INCORRECT_STATUS );
		}

		const remainingPlayers = gameData.playerCount - Object.keys( gameData.players ).length;

		if ( remainingPlayers <= 0 ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, gameData.id );
			throw new HttpException( 400, Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS );
		}

		this.logger.debug( "<< validateAddBotsRequest()" );
		return remainingPlayers;
	}

	async createTeams( gameData: GameData ) {
		this.logger.debug( ">> validateCreateTeamsRequest()" );

		if ( gameData.status !== GameStatus.PLAYERS_READY ) {
			this.logger.debug( "Game Present but not in correct status!" );
			throw new HttpException( 400, Messages.INCORRECT_STATUS );
		}

		if ( Object.keys( gameData.players ).length !== gameData.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS, gameData.id );
			throw new HttpException( 400, Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS );
		}

		this.logger.debug( "<< validateCreateTeamsRequest()" );
	}

	async startGame( gameData: GameData ) {
		this.logger.debug( ">> validateStartGameRequest()" );

		if ( gameData.status !== GameStatus.TEAMS_CREATED ) {
			this.logger.debug( "Game Present but not in correct status!" );
			throw new HttpException( 400, Messages.INCORRECT_STATUS );
		}

		this.logger.debug( "<< validateStartGameRequest()" );
	}

	async askCard( { gameData, playerData, cardsData, input }: MoveValidatorInput<AskCardInput> ) {
		this.logger.debug( ">> validateAskCardRequest()" );

		await this.validateMoveRequest( gameData, playerData.id );

		const askedPlayer = gameData.players[ input.askedFrom ];
		const playerWithAskedCard = gameData.players[ cardsData.mappings[ input.askedFor ] ];

		if ( !askedPlayer ) {
			this.logger.debug(
				"%s GameId: %s, PlayerId: %s",
				Messages.PLAYER_NOT_PART_OF_GAME,
				gameData.id,
				input.askedFrom
			);
			throw new HttpException( 400, Messages.PLAYER_NOT_PART_OF_GAME );
		}

		if ( playerWithAskedCard.id === playerData.id ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_CARD_WITH_ASKING_PLAYER, gameData.id );
			throw new HttpException( 400, Messages.ASKED_CARD_WITH_ASKING_PLAYER );
		}

		if ( playerData.teamId === askedPlayer.teamId ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_PLAYER_FROM_SAME_TEAM, gameData.id );
			throw new HttpException( 400, Messages.ASKED_PLAYER_FROM_SAME_TEAM );
		}

		this.logger.debug( "<< validateAskCardRequest()" );
		return { askedPlayer, playerWithAskedCard };
	}

	async callSet( { input: { data }, gameData, playerData, cardsData }: MoveValidatorInput<CallSetInput> ) {
		this.logger.debug( ">> validateCallSetRequest()" );

		await this.validateMoveRequest( gameData, playerData.id );

		const calledCards = Object.keys( data ).map( getPlayingCardFromId );
		const cardSets = new Set( calledCards.map( card => card.set ) );

		const calledPlayers = Array.from( new Set( Object.values( data ) ) ).map( playerId => {
			const player = gameData.players[ playerId ];
			if ( !player ) {
				this.logger.error(
					"%s GameId: %s, PlayerId: %s",
					Messages.PLAYER_NOT_PART_OF_GAME,
					gameData.id,
					playerId
				);
				throw new HttpException( 400, Messages.PLAYER_NOT_PART_OF_GAME );
			}
			return player;
		} );

		if ( !Object.values( data ).includes( playerData.id ) ) {
			this.logger.error( "%s UserId: %s", Messages.DIDNT_CALL_OWN_CARDS, playerData.id );
			throw new HttpException( 400, Messages.DIDNT_CALL_OWN_CARDS );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.MULTIPLE_SETS_CALLED, playerData.id );
			throw new HttpException( 400, Messages.MULTIPLE_SETS_CALLED );
		}

		const [ calledSet ] = cardSets;
		const correctCall: Record<string, string> = {};

		Object.keys( cardsData.mappings ).forEach( cardId => {
			const card = getPlayingCardFromId( cardId );
			if ( card.set === calledSet ) {
				correctCall[ cardId ] = cardsData.mappings[ cardId ];
			}
		} );

		if ( !isCardSetInHand( playerData.hand, calledSet ) ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.SET_CALLED_WITHOUT_CARDS, playerData.id, calledSet );
			throw new HttpException( 400, Messages.SET_CALLED_WITHOUT_CARDS );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.SET_CALLED_FROM_MULTIPLE_TEAMS, playerData.id );
			throw new HttpException( 400, Messages.SET_CALLED_FROM_MULTIPLE_TEAMS );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.ALL_CARDS_NOT_CALLED, playerData.id, calledSet );
			throw new HttpException( 400, Messages.ALL_CARDS_NOT_CALLED );
		}

		this.logger.debug( "<< validateCallSetRequest()" );
		return { correctCall, calledSet };
	}

	async transferTurn( { gameData, cardsData, input, playerData }: MoveValidatorInput<TransferTurnInput> ) {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		await this.validateMoveRequest( gameData, playerData.id );

		const [ lastMove ] = gameData.moves;

		if ( lastMove.type !== MoveType.CALL_SET || !lastMove.success ) {
			this.logger.error( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			throw new HttpException( 400, Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
		}

		const transferringPlayer = gameData.players[ playerData.id ];
		const receivingPlayer = gameData.players[ input.transferTo ];
		const receivingPlayerHand = cardsData.hands[ input.transferTo ] ?? [];

		if ( !receivingPlayer ) {
			this.logger.error( Messages.PLAYER_NOT_PART_OF_GAME );
			throw new HttpException( 400, Messages.PLAYER_NOT_PART_OF_GAME );
		}

		if ( receivingPlayerHand.length === 0 ) {
			this.logger.error( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			throw new HttpException( 400, Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( Messages.TRANSFER_TO_OPPONENT_TEAM );
			throw new HttpException( 400, Messages.TRANSFER_TO_OPPONENT_TEAM );
		}

		this.logger.debug( "<< validateTransferTurnRequest()" );
		return { transferringPlayer, receivingPlayer };
	}

	private async validateMoveRequest( gameData: GameData, userId: string ) {
		if ( gameData.status !== GameStatus.IN_PROGRESS ) {
			this.logger.debug( "Game Present but not in correct status!" );
			throw new HttpException( 400, Messages.INCORRECT_STATUS );
		}

		if ( gameData.currentTurn !== userId ) {
			this.logger.error( "It is not logged in User's turn! UserId: %s", userId );
			throw new HttpException( 400, Messages.NOT_YOUR_TURN );
		}
	}
}

export const literatureValidators = new LiteratureValidators( prismaService );