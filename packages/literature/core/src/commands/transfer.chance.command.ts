import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AggregatedGameData, TransferChanceInput, TransferMoveData } from "@literature/data";
import { MoveType } from "@literature/data";
import { LoggerFactory } from "@s2h/core";
import { BadRequestException } from "@nestjs/common";
import type { UserAuthInfo } from "@auth/data";
import { PrismaService } from "../services";
import { GameUpdateEvent, MoveCreatedEvent } from "../events";
import { Messages } from "../constants";

export class TransferChanceCommand implements ICommand {
	constructor(
		public readonly input: TransferChanceInput,
		public readonly currentGame: AggregatedGameData,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( TransferChanceCommand )
export class TransferChanceCommandHandler implements ICommandHandler<TransferChanceCommand, string> {

	private readonly logger = LoggerFactory.getLogger( TransferChanceCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { input, currentGame, authInfo }: TransferChanceCommand ): Promise<string> {
		this.logger.debug( ">> execute()" );
		const [ lastMove ] = currentGame.moves;

		if ( lastMove.type !== MoveType.CALL_SET || !lastMove.success ) {
			this.logger.error( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			throw new BadRequestException( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
		}

		const transferringPlayer = currentGame.players[ authInfo.id ];
		const receivingPlayer = currentGame.players[ input.transferTo ];
		const receivingPlayerHand = currentGame.hands[ input.transferTo ] ?? [];

		if ( !receivingPlayer ) {
			this.logger.error( Messages.PLAYER_NOT_PART_OF_GAME );
			throw new BadRequestException( Messages.PLAYER_NOT_PART_OF_GAME );
		}

		if ( receivingPlayerHand.length === 0 ) {
			this.logger.error( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			throw new BadRequestException( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( Messages.TRANSFER_TO_OPPONENT_TEAM );
			throw new BadRequestException( Messages.TRANSFER_TO_OPPONENT_TEAM );
		}

		const transferData: TransferMoveData = { to: input.transferTo, from: transferringPlayer.id };
		const description = `${ transferringPlayer.name } transferred the chance to ${ receivingPlayer.name }`;

		const move = await this.prisma.move.create( {
			data: {
				gameId: currentGame.id,
				type: MoveType.TRANSFER_CHANCE,
				success: true,
				data: transferData,
				description
			}
		} );

		this.eventBus.publish( new MoveCreatedEvent( move ) );
		currentGame.moves = [ move, ...currentGame.moves ];

		await this.prisma.game.update( {
			where: { id: currentGame.id },
			data: { currentTurn: receivingPlayer.id }
		} );

		currentGame.currentTurn = receivingPlayer.id;
		this.eventBus.publish( new GameUpdateEvent( currentGame, authInfo ) );

		return currentGame.id;
	}
}