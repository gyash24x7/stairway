import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { AskCardInput, AskMoveData, LiteratureGame, LiteratureMove, LiteraturePlayer } from "@literature/data";
import { CardHand, PlayingCard } from "@s2h/cards";
import { BadRequestException } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { LoggerFactory } from "@s2h/core";
import { LiteratureService } from "../services";

export class AskCardCommand implements ICommand {
	constructor(
		public readonly input: AskCardInput,
		public readonly currentGame: LiteratureGame,
		public readonly currentPlayer: LiteraturePlayer,
		public readonly currentGameHands: Record<string, CardHand>
	) {}
}

@CommandHandler( AskCardCommand )
export class AskCardCommandHandler implements ICommandHandler<AskCardCommand, string> {

	private readonly logger = LoggerFactory.getLogger( AskCardCommandHandler );

	constructor( private readonly literatureService: LiteratureService ) {}

	async execute( { input, currentGame, currentPlayer, currentGameHands }: AskCardCommand ) {
		const askingPlayer = currentGame.players[ currentPlayer.id ];
		const askedPlayer = currentGame.players[ input.askedFrom ];
		const askingPlayerHand = currentGameHands[ askingPlayer.id ];

		if ( !askedPlayer ) {
			this.logger.debug( "The asked player doesn't exist! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		if ( askingPlayer.teamId! === askedPlayer.teamId! ) {
			this.logger.debug( "The asked player is from the same team! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		const askedCard = PlayingCard.from( input.askedFor );
		if ( askingPlayerHand.contains( askedCard ) ) {
			this.logger.debug( "The asked card is with asking player itself! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		const askData = new AskMoveData( { from: input.askedFrom, by: currentPlayer.id, card: input.askedFor } );
		const updatedHands = currentGame.executeAskMove( askData, currentGameHands );
		const id = new ObjectId().toHexString();
		const move = LiteratureMove.buildAskMove( id, currentGame.id, askData, !!updatedHands );

		await this.literatureService.saveMove( move );

		if ( !!updatedHands ) {
			await Promise.all( Object.keys( updatedHands ).map( playerId =>
				this.literatureService.updateHand( currentGame.id, playerId, updatedHands[ playerId ] )
			) );
		}

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}
}