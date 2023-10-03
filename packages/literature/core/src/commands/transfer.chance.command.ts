import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { AggregatedGameData, TransferChanceInput, TransferMoveData } from "@literature/data";
import { LoggerFactory } from "@s2h/core";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma } from "../utils";
import { MoveType } from "@literature/prisma";
import type { UserAuthInfo } from "@auth/data";

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

	async execute( { input, currentGame, authInfo }: TransferChanceCommand ): Promise<string> {
		this.logger.debug( ">> execute()" );
		const lastMove = await prisma.move.findFirstOrThrow( {
			where: { gameId: currentGame.id },
			orderBy: { timestamp: "desc" }
		} );

		if ( lastMove.type !== MoveType.CALL_SET || !lastMove.success ) {
			this.logger.error( "Chance can only be transferred after a successful call move!" );
			throw new BadRequestException();
		}

		const transferringPlayer = currentGame.players[ authInfo.id ];
		const receivingPlayer = currentGame.players[ input.transferTo ];
		const receivingPlayerHand = currentGame.hands[ input.transferTo ];

		if ( !receivingPlayer ) {
			this.logger.error( "Cannot transfer chance to unknown player!" );
			throw new NotFoundException();
		}

		if ( receivingPlayerHand.length === 0 ) {
			this.logger.error( "Chance can only be transferred to a player with cards!" );
			throw new BadRequestException();
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( "Chance can only be transferred to member of your team!" );
			throw new BadRequestException();
		}

		const transferData: TransferMoveData = { to: input.transferTo, from: transferringPlayer.id };
		const description = `${ transferringPlayer.name } transferred the chance to ${ receivingPlayer.name }`;

		await prisma.move.create( {
			data: {
				gameId: currentGame.id,
				type: MoveType.TRANSFER_CHANCE,
				success: true,
				data: transferData,
				description
			}
		} );

		await prisma.game.update( {
			where: { id: currentGame.id },
			data: { currentTurn: receivingPlayer.id }
		} );

		return currentGame.id;
	}
}