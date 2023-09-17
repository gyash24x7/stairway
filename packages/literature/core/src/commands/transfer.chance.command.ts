import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { LiteratureGame, LiteratureMove, LiteraturePlayer, TransferChanceInput } from "@literature/data";
import type { CardHand } from "@s2h/cards";
import { LoggerFactory } from "@s2h/core";
import { NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { LiteratureService } from "../services";

export class TransferChanceCommand implements ICommand {
	constructor(
		public readonly input: TransferChanceInput,
		public readonly currentGame: LiteratureGame,
		public readonly currentPlayer: LiteraturePlayer,
		public readonly currentGameHands: Record<string, CardHand>
	) {}
}

@CommandHandler( TransferChanceCommand )
export class TransferChanceCommandHandler implements ICommandHandler<TransferChanceCommand, string> {

	private readonly logger = LoggerFactory.getLogger( TransferChanceCommandHandler );

	constructor( private readonly literatureService: LiteratureService ) {}


	async execute( { input, currentGame, currentPlayer, currentGameHands }: TransferChanceCommand ): Promise<string> {
		this.logger.debug( ">> execute()" );
		const lastMove = await this.literatureService.findLastCallMove( currentGame.id );

		if ( !lastMove?.success ) {
			this.logger.error( "Chance can only be transferred after successful call!" );
			throw new NotFoundException();
		}

		const receivingPlayer = currentGame.players[ input.transferTo ];
		const receivingPlayerHand = currentGameHands[ receivingPlayer.id ];

		if ( !receivingPlayer ) {
			this.logger.error( "Cannot transfer chance to unknown player!" );
			throw new NotFoundException();
		}

		if ( receivingPlayerHand.length === 0 ) {
			this.logger.error( "Chance can only be transferred to a player with cards!" );
			throw new NotFoundException();
		}

		if ( receivingPlayer.teamId !== currentPlayer.teamId ) {
			this.logger.error( "Chance can only be transferred to member of your team!" );
			throw new NotFoundException();
		}

		const transferData = { to: input.transferTo, from: currentPlayer.id };
		currentGame.executeTransferMove( transferData );

		const moveId = new ObjectId().toHexString();
		const move = LiteratureMove.buildTransferMove( moveId, currentGame.id, transferData );
		await this.literatureService.saveMove( move );

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}
}