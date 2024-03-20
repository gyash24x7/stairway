import { getAskableCardsOfSet, getCardSetsInHand, type PlayingCard } from "@common/cards";
import { LoggerFactory } from "@common/core";
import type {
	AskCardInput,
	AskMove,
	CardLocation,
	CardLocationsData,
	CardsData,
	GameData,
	Move
} from "@literature/data";
import { CommandBus, CommandHandler, type ICommand, type ICommandHandler, QueryBus } from "@nestjs/cqrs";
import { CardLocationsDataQuery, CardsDataQuery } from "../queries";
import { Constants } from "../utils";
import { AskCardCommand } from "./ask.card.command";

export class ExecuteBotMoveCommand implements ICommand {
	constructor(
		public readonly gameData: GameData,
		public readonly currentPlayer: string
	) {}
}

type WeightedAsk = { cardId: string, playerId: string, weight: number }

// type WeightedCall = { cardSet: CardSet, callData: Record<string, string>, weight: number }

@CommandHandler( ExecuteBotMoveCommand )
export class ExecuteBotMoveCommandHandler implements ICommandHandler<ExecuteBotMoveCommand, Move> {

	private readonly logger = LoggerFactory.getLogger( ExecuteBotMoveCommandHandler );

	constructor(
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {}

	async execute( { gameData, currentPlayer }: ExecuteBotMoveCommand ) {
		this.logger.debug( ">> executeBotMove()" );

		const cardLocationsDataQuery = new CardLocationsDataQuery( gameData.id, currentPlayer );
		const cardLocationsData: CardLocationsData = await this.queryBus.execute( cardLocationsDataQuery );

		const cardsDataQuery = new CardsDataQuery( gameData.id, currentPlayer );
		const cardsData: CardsData = await this.queryBus.execute( cardsDataQuery );

		const [ bestAsk ] = this.suggestAsk(
			gameData,
			currentPlayer,
			cardLocationsData[ currentPlayer ],
			cardsData.hands[ currentPlayer ]
		);
		const input: AskCardInput = { from: bestAsk.playerId, for: bestAsk.cardId, gameId: gameData.id };

		const askCardCommand = new AskCardCommand( input, gameData, currentPlayer );
		const askMove: AskMove = await this.commandBus.execute( askCardCommand );

		this.logger.debug( "<< executeBotMove()" );
		return askMove;
	}

	// async suggestCall( { cardLocations, oppositeTeamMembers }: PlayerSpecificData ) {
	// 	const deck = removeCardsOfRank( shuffle( SORTED_DECK ), CardRank.SEVEN );
	// 	const weightedCalls: WeightedCall[] = [];
	//
	// 	for ( const cardSet of CARD_SETS ) {
	// 		const cardsOfSet = getCardsOfSet( deck, cardSet );
	// 		const cardLocationMap: Record<string, string[]> = {};
	//
	// 		let totalCardLocationsForSet = 0;
	// 		let possiblePlayers = new Set<string>();
	//
	// 		for ( const card of cardsOfSet ) {
	// 			const cardLocations = cardLocations.cardLocations[ card.id ];
	// 			totalCardLocationsForSet += cardLocations.length;
	// 			cardLocations.forEach( possiblePlayers.add );
	// 			cardLocationMap[ card.id ] = cardLocations;
	// 		}
	//
	// 		if ( possiblePlayers.size === 0 ) {
	// 			continue;
	// 		}
	//
	// 		let isCardSetWithUs = true;
	// 		for ( const possiblePlayer of possiblePlayers ) {
	// 			if ( oppositeTeamMembers.includes( possiblePlayer ) ) {
	// 				isCardSetWithUs = false;
	// 			}
	// 		}
	//
	// 		if ( !isCardSetWithUs ) {
	// 			continue;
	// 		}
	//
	// 		let weight = 720;
	// 		if ( totalCardLocationsForSet > 6 ) {
	// 			weight /= totalCardLocationsForSet - 6;
	// 		}
	//
	// 		const callData: Record<string, string> = {};
	// 		const takenPlayers: string[] = [];
	//
	// 		for ( const card of cardsOfSet ) {
	// 			let cardLocations = cardLocationMap[ card.id ];
	// 			if ( cardLocations.length === 1 ) {
	// 				callData[ card.id ] = cardLocations[ 0 ];
	// 				takenPlayers.push( cardLocations[ 0 ] );
	// 			} else {
	// 				const randomPlayer;
	// 				callData[ card.id ] =
	// 					takenPlayers.push( cardLocations );
	// 			}
	// 		}
	// 	}
	// }

	// private async selectRandomPlayer( possiblePlayers: string[], takenPlayers: string[] ) {
	// 	let random = Math.floor( Math.random() * possiblePlayers.length );
	// 	const randomPlayer = possiblePlayers[ random ];
	//
	// 	if ( takenPlayers.includes( randomPlayer ) ) {
	// 		return this.selectRandomPlayer(
	// 			possiblePlayers.toSpliced( random, 1 ),
	// 			takenPlayers.toSpliced( takenPlayers.indexOf( randomPlayer ), 1 )
	// 		);
	// 	}
	//
	// 	return randomPlayer;
	// }

	private suggestAsk(
		gameData: GameData,
		currentPlayer: string,
		cardLocations: CardLocation[],
		hand: PlayingCard[]
	) {
		const teamId = gameData.players[ currentPlayer ].teamId;
		const oppositeTeamMembers = Object.values( gameData.players )
			.filter( player => player.teamId !== teamId )
			.map( player => player.id );

		const askableCardSets = getCardSetsInHand( hand );
		const weightedAsks: WeightedAsk[] = [];

		for ( const cardSet of askableCardSets ) {
			const cardsOfSet = getAskableCardsOfSet( hand, cardSet );

			for ( const card of cardsOfSet ) {
				const cardLocation = cardLocations.find( ( { cardId } ) => cardId === card.id );

				if ( !cardLocation || cardLocation.playerIds.length === 0 ) {
					continue;
				}

				const possibleAsks: WeightedAsk[] = cardLocation.playerIds
					.filter( playerId => oppositeTeamMembers.includes( playerId ) )
					.map( playerId => {
						const weight = Constants.MAX_ASK_WEIGHT / cardLocation.playerIds.length;
						return { cardId: card.id, playerId, weight };
					} );

				weightedAsks.push( ...possibleAsks );
			}
		}

		return weightedAsks.toSorted( ( a, b ) => b.weight - a.weight );
	}
}