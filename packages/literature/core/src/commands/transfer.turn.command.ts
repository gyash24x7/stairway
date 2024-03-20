import { LoggerFactory } from "@common/core";
import type { CardsData, GameData, TransferMove, TransferMoveData, TransferTurnInput } from "@literature/data";
import { CommandHandler, EventBus, ICommand, ICommandHandler, QueryBus } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { MoveCreatedEvent } from "../events";
import { CardsDataQuery } from "../queries";
import { DatabaseService } from "../services";
import { Messages } from "../utils";

export class TransferTurnCommand implements ICommand {
	constructor(
		public readonly input: TransferTurnInput,
		public readonly gameData: GameData,
		public readonly currentPlayer: string
	) {}
}

@CommandHandler( TransferTurnCommand )
export class TransferTurnCommandHandler implements ICommandHandler<TransferTurnCommand, TransferMove> {

	private readonly logger = LoggerFactory.getLogger( TransferTurnCommandHandler );

	constructor(
		private readonly db: DatabaseService,
		private readonly queryBus: QueryBus,
		private readonly eventBus: EventBus
	) {}

	async execute( command: TransferTurnCommand ) {
		this.logger.debug( ">> transferTurn()" );

		const { transferringPlayer, receivingPlayer, cardsData } = await this.validate( command );
		const { input, gameData } = command;

		const transferMoveData: TransferMoveData = { to: input.transferTo, from: transferringPlayer.id };
		const description = `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`;

		const move = await this.db.createMove( {
			gameId: gameData.id,
			playerId: transferringPlayer.id,
			type: "TRANSFER_TURN",
			success: true,
			data: transferMoveData,
			description
		} );

		this.eventBus.publish( new MoveCreatedEvent( gameData, cardsData, move ) );
		this.logger.debug( "Published MoveCreated Event!" );

		this.logger.debug( "<< transferTurn()" );
		return move as TransferMove;
	};

	async validate( { gameData, input, currentPlayer }: TransferTurnCommand ) {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		const cardsDataQuery = new CardsDataQuery( gameData.id );
		const cardsData: CardsData = await this.queryBus.execute( cardsDataQuery );
		const [ lastMove ] = gameData.moves;

		if ( lastMove.type !== "CALL_SET" || !lastMove.success ) {
			this.logger.error( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.TRANSFER_AFTER_SUCCESSFUL_CALL } );
		}

		const transferringPlayer = gameData.players[ currentPlayer ];
		const receivingPlayer = gameData.players[ input.transferTo ];
		const receivingPlayerHand = cardsData.hands[ input.transferTo ] ?? [];

		if ( !receivingPlayer ) {
			this.logger.error( Messages.PLAYER_NOT_PART_OF_GAME );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
		}

		if ( receivingPlayerHand.length === 0 ) {
			this.logger.error( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.NO_CARDS_WITH_RECEIVING_PLAYER } );
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( Messages.TRANSFER_TO_OPPONENT_TEAM );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.TRANSFER_TO_OPPONENT_TEAM } );
		}

		this.logger.debug( "<< validateTransferTurnRequest()" );
		return { transferringPlayer, receivingPlayer, cardsData };
	}
}
