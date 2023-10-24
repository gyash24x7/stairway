import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type {
	CallMove,
	CallMoveData,
	CallSetInput,
	CardMappingData,
	GameData,
	PlayerSpecificData
} from "@literature/types";
import { MoveType } from "@literature/types";
import { cardSetMap, getPlayingCardFromId, isCardSetInHand } from "@s2h/cards";
import { BadRequestException } from "@nestjs/common";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { MoveCreatedEvent } from "../events";
import { Messages } from "../constants";

export class CallSetCommand implements ICommand {
	constructor(
		public readonly input: CallSetInput,
		public readonly gameData: GameData,
		public readonly playerData: PlayerSpecificData,
		public readonly cardMappings: CardMappingData
	) {}
}

@CommandHandler( CallSetCommand )
export class CallSetCommandHandler implements ICommandHandler<CallSetCommand, CallMove> {

	private readonly logger = LoggerFactory.getLogger( CallSetCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: CallSetCommand ) {
		this.logger.debug( ">> executeCallSetCommand()" );

		const { input: { data }, gameData, playerData, cardMappings } = command;
		const { correctCall, calledSet } = this.validate( command );

		const callingPlayer = gameData.players[ playerData.id ]!;

		let success = true;
		let successString = "correctly!";

		const cardsOfCallingSet = cardSetMap[ calledSet ];
		for ( const card of cardsOfCallingSet ) {
			if ( correctCall[ card.id ] !== data[ card.id ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		const callMoveData: CallMoveData = {
			by: playerData.id,
			cardSet: calledSet,
			actualCall: data,
			correctCall
		};

		const move = await this.prisma.literature.move.create( {
			data: {
				gameId: gameData.id,
				type: MoveType.CALL_SET,
				success,
				description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
				data: callMoveData
			}
		} );

		this.eventBus.publish( new MoveCreatedEvent( move, gameData, cardMappings ) );
		this.logger.debug( "Published MoveCreatedEvent!" );

		this.logger.debug( "<< executeCallSetCommand()" );
		return { ...move, data: callMoveData };
	}

	private validate( { input: { data }, gameData, playerData, cardMappings }: CallSetCommand ) {
		this.logger.debug( ">> validateCallSetCommand()" );
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
				throw new BadRequestException( Messages.PLAYER_NOT_PART_OF_GAME );
			}
			return player;
		} );

		if ( !Object.values( data ).includes( playerData.id ) ) {
			this.logger.error( "%s UserId: %s", Messages.DIDNT_CALL_OWN_CARDS, playerData.id );
			throw new BadRequestException( Messages.DIDNT_CALL_OWN_CARDS );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.MULTIPLE_SETS_CALLED, playerData.id );
			throw new BadRequestException( Messages.MULTIPLE_SETS_CALLED );
		}

		const [ calledSet ] = cardSets;
		const correctCall: Record<string, string> = {};

		Object.keys( cardMappings ).forEach( cardId => {
			const card = getPlayingCardFromId( cardId );
			if ( card.set === calledSet ) {
				correctCall[ cardId ] = cardMappings[ cardId ];
			}
		} );

		if ( !isCardSetInHand( playerData.hand, calledSet ) ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.SET_CALLED_WITHOUT_CARDS, playerData.id, calledSet );
			throw new BadRequestException( Messages.SET_CALLED_WITHOUT_CARDS );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.SET_CALLED_FROM_MULTIPLE_TEAMS, playerData.id );
			throw new BadRequestException( Messages.SET_CALLED_FROM_MULTIPLE_TEAMS );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.ALL_CARDS_NOT_CALLED, playerData.id, calledSet );
			throw new BadRequestException( Messages.ALL_CARDS_NOT_CALLED );
		}

		this.logger.debug( "<< validateCallSetCommand()" );
		return { correctCall, calledSet };
	}
}