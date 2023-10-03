import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { LoggerFactory } from "@s2h/core";
import { prisma } from "../utils";
import type { AggregatedGameData } from "@literature/data";
import { BadRequestException } from "@nestjs/common";
import { CardRank, generateHandsFromCards, removeCardsOfRank, shuffle, SORTED_DECK } from "@s2h/cards";
import { GameStatus } from "@literature/prisma";

export class StartGameCommand implements ICommand {
	constructor( public readonly currentGame: AggregatedGameData ) {}
}

@CommandHandler( StartGameCommand )
export class StartGameCommandHandler implements ICommandHandler<StartGameCommand, string> {

	private readonly logger = LoggerFactory.getLogger( StartGameCommandHandler );

	async execute( { currentGame }: StartGameCommand ) {
		this.logger.debug( ">> execute()" );
		if ( currentGame!.status !== GameStatus.TEAMS_CREATED ) {
			this.logger.debug( "The teams have not been created for the game! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		let deck = shuffle( SORTED_DECK );
		deck = removeCardsOfRank( deck, CardRank.SEVEN );

		generateHandsFromCards( deck, currentGame.playerCount ).map( async ( hand, index ) => {
			await Promise.all(
				hand.map( card => {
					return prisma.cardMapping.create( {
						data: {
							cardId: card.id,
							gameId: currentGame.id,
							playerId: currentGame.playerList[ index ].id
						}
					} );
				} )
			);
		} );

		await prisma.game.update( {
			where: { id: currentGame.id },
			data: { status: GameStatus.IN_PROGRESS }
		} );

		return currentGame.id;
	}
}