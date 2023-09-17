import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import { IAggregatedGameData, LiteratureGame, LiteraturePlayer } from "@literature/data";
import { LiteratureService } from "../services";
import { CardHand } from "@s2h/cards";

export class AggregateGameQuery implements IQuery {
	constructor(
		public readonly currentGame: LiteratureGame,
		public readonly currentPlayer: LiteraturePlayer
	) {}
}

@QueryHandler( AggregateGameQuery )
export class AggregateGameQueryHandler implements IQueryHandler<AggregateGameQuery, IAggregatedGameData> {

	constructor( private readonly literatureService: LiteratureService ) {}

	async execute( { currentGame, currentPlayer }: AggregateGameQuery ) {
		const gameHands = await this.literatureService.findHandsForGame( currentGame.id );
		const gameMoves = await this.literatureService.findMovesForGame( currentGame.id );

		const currentGameHands: Record<string, CardHand> = {};
		for ( const hand of gameHands ) {
			currentGameHands[ hand.playerId ] = CardHand.from( hand.hand );
		}

		const aggregateMap = LiteratureGame.aggregate( currentGame, currentGameHands, gameMoves );
		return aggregateMap[ currentPlayer.id ].serialize();
	}
}