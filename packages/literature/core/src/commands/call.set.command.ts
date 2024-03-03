import { cardSetMap, getPlayingCardFromId, isCardSetInHand } from "@common/cards";
import { LoggerFactory } from "@common/core";
import type { CallMove, CallMoveData, CallSetInput, CardsData, GameData, PlayerSpecificData } from "@literature/data";
import { CommandHandler, EventBus, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { MoveCreatedEvent } from "../events";
import { DatabaseService } from "../services";
import { Messages } from "../utils";

export class CallSetCommand implements ICommand {
	constructor(
		public readonly input: CallSetInput,
		public readonly gameData: GameData,
		public readonly playerData: PlayerSpecificData,
		public readonly cardsData: CardsData
	) {}
}

@CommandHandler( CallSetCommand )
export class CallSetCommandHandler implements ICommandHandler<CallSetCommand, CallMove> {

	private readonly logger = LoggerFactory.getLogger( CallSetCommandHandler );

	constructor(
		private readonly db: DatabaseService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: CallSetCommand ) {
		this.logger.debug( ">> callSet()" );

		const { correctCall, calledSet } = await this.validate( command );
		const { gameData, playerData, input, cardsData } = command;

		const callingPlayer = gameData.players[ playerData.id ]!;

		let success = true;
		let successString = "correctly!";

		const cardsOfCallingSet = cardSetMap[ calledSet ];
		for ( const card of cardsOfCallingSet ) {
			if ( correctCall[ card.id ] !== input.data[ card.id ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		const callMoveData: CallMoveData = {
			by: playerData.id,
			cardSet: calledSet,
			actualCall: input.data,
			correctCall
		};

		const move = await this.db.createMove( {
			gameId: gameData.id,
			type: "CALL_SET",
			success,
			description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
			data: callMoveData
		} );

		this.eventBus.publish( new MoveCreatedEvent( gameData, cardsData, move ) );
		this.logger.debug( "Published MoveCreated Event!" );

		this.logger.debug( "<< callSet()" );
		return move as CallMove;
	};

	async validate( { input: { data }, gameData, playerData, cardsData }: CallSetCommand ) {
		this.logger.debug( ">> validateCallSetRequest()" );

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
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}
			return player;
		} );

		if ( !Object.values( data ).includes( playerData.id ) ) {
			this.logger.error( "%s UserId: %s", Messages.DIDNT_CALL_OWN_CARDS, playerData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.DIDNT_CALL_OWN_CARDS } );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.MULTIPLE_SETS_CALLED, playerData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.MULTIPLE_SETS_CALLED } );
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
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.SET_CALLED_WITHOUT_CARDS } );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.SET_CALLED_FROM_MULTIPLE_TEAMS, playerData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.SET_CALLED_FROM_MULTIPLE_TEAMS } );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.ALL_CARDS_NOT_CALLED, playerData.id, calledSet );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ALL_CARDS_NOT_CALLED } );
		}

		this.logger.debug( "<< validateCallSetRequest()" );
		return { correctCall, calledSet };
	}
}