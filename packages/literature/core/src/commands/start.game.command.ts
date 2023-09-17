import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { LiteratureGame, LiteratureGameHand, LiteratureGameStatus } from "@literature/data";
import { LoggerFactory } from "@s2h/core";
import { LiteratureService } from "../services";
import { BadRequestException } from "@nestjs/common";
import { ObjectId } from "mongodb";

export class StartGameCommand implements ICommand {
	constructor( public readonly currentGame: LiteratureGame ) {}
}

@CommandHandler( StartGameCommand )
export class StartGameCommandHandler implements ICommandHandler<StartGameCommand, string> {

	private readonly logger = LoggerFactory.getLogger( StartGameCommandHandler );

	constructor( private readonly literatureService: LiteratureService ) {}


	async execute( { currentGame }: StartGameCommand ) {
		this.logger.debug( ">> execute()" );
		if ( currentGame!.status !== LiteratureGameStatus.TEAMS_CREATED ) {
			this.logger.debug( "The teams have not been created for the game! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		const hands = currentGame.dealCards();
		await Promise.all(
			Object.keys( hands ).map( playerId => {
				const id = new ObjectId().toHexString();
				const hand = LiteratureGameHand.create( id, playerId, currentGame.id, hands[ playerId ] );
				return this.literatureService.saveHand( hand );
			} )
		);
		currentGame.status = LiteratureGameStatus.IN_PROGRESS;

		await this.literatureService.saveGame( currentGame );
		return currentGame.id;
	}
}