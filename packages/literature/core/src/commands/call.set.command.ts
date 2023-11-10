import type { CallMove, CallMoveData, CallSetInput, CardsData, GameData, PlayerSpecificData } from "@literature/types";
import { MoveType } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { cardSetMap } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { MoveCreatedEvent } from "../events";
import { CallSetValidator } from "../validators";

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
		private readonly prisma: PrismaService,
		private readonly validator: CallSetValidator,
		private readonly eventBus: EventBus
	) {}

	async execute( command: CallSetCommand ) {
		this.logger.debug( ">> executeCallSetCommand()" );

		const { input: { data }, gameData, playerData, cardsData } = command;
		const { correctCall, calledSet } = await this.validator.validate( command );

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

		this.eventBus.publish( new MoveCreatedEvent( move, gameData, cardsData ) );
		this.logger.debug( "Published MoveCreatedEvent!" );

		this.logger.debug( "<< executeCallSetCommand()" );
		return { ...move, data: callMoveData };
	}
}