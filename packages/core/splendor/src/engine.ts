import { GAME_NAME } from "./utils";
import { AbstractGameEngine } from "@s2h/engine";
import { roundRobin } from "@s2h/engine/utils";
import { createLogger } from "@s2h/utils/logger";
import type {
	Cost,
	Gem,
	SplendorConfig,
	SplendorData,
	SplendorMoves,
	SplendorPlayerView,
	SplendorSharedView
} from "./types";
import {
	DEFAULT_TOKENS,
	findCardInOpenCards,
	generateDecks,
	generateNobles
} from "./utils";

const MAX_TOKENS_IN_HAND = 10;
const MAX_RESERVED = 3;

const logger = createLogger( "Splendor:Engine" );

export class SplendorEngine extends AbstractGameEngine<
	SplendorData,
	SplendorMoves,
	SplendorConfig,
	SplendorSharedView,
	SplendorPlayerView
> {

	public static readonly NAME = GAME_NAME;

	protected readonly structure = this.defineStructure( {
		name: SplendorEngine.NAME,
		resolveNextPlayer: roundRobin,

		sharedView: ( { state } ) => {
			const { decks, ...rest } = state;
			return rest;
		},

		playerView: ( _data, playerId ) => ( { playerId } ),

		setup: () => ( {
			tokens: DEFAULT_TOKENS,
			cards: { 1: [], 2: [], 3: [] },
			nobles: [],
			decks: generateDecks(),
			playerData: {}
		} ),

		hooks: {
			onJoin: ( { state }, playerId ) => {
				state.playerData[ playerId ] = {
					tokens: { ...DEFAULT_TOKENS },
					cards: [],
					nobles: [],
					reserved: [],
					points: 0
				};
				return state;
			},

			onStart: ( { state } ) => {
				const playerCount = Object.keys( state.playerData ).length;
				const tokenCount = playerCount === 4 ? 7 : 5;

				state.tokens = {
					diamond: tokenCount,
					sapphire: tokenCount,
					emerald: tokenCount,
					ruby: tokenCount,
					onyx: tokenCount,
					gold: 5
				};
				state.nobles = generateNobles( playerCount );
				state.cards = {
					1: state.decks[ 1 ].splice( 0, 4 ),
					2: state.decks[ 2 ].splice( 0, 4 ),
					3: state.decks[ 3 ].splice( 0, 4 )
				};
				return state;
			},

			onEnd: ( { state, context } ) => {
				state.winner = context.players.reduce( ( best, id ) => {
					const points = state.playerData[ id ]?.points ?? 0;
					const bestPoints = state.playerData[ best ]?.points ?? 0;
					return points > bestPoints ? id : best;
				} );

				return state;
			}
		},

		moves: {
			pickTokens: {
				validate: ( { state }, playerId, input ) => {
					logger.debug( ">> validatePickTokens()" );

					const data = state;
					const player = data.playerData[ playerId ];

					if ( "gold" in input.tokens ) {
						throw new Error( "Gold tokens cannot be picked directly!" );
					}

					for ( const gem of Object.keys( input.tokens ).map( g => g as Gem ) ) {
						const take = input.tokens[ gem ] ?? 0;
						if ( take > data.tokens[ gem ] ) {
							throw new Error( `Not enough ${ gem } tokens available!` );
						}
					}

					const availableTypes = Object.keys( data.tokens ).map( g => g as Gem )
						.filter( gem => data.tokens[ gem ] > 0 );

					const typesPicked = Object.keys( input.tokens ).map( g => g as Gem )
						.filter( gem => ( input.tokens[ gem ] ?? 0 ) > 0 );

					if ( typesPicked.length === 1 ) {
						const pickedCount = input.tokens[ typesPicked[ 0 ] ] ?? 0;
						if ( pickedCount > 2 ) {
							throw new Error(
								"You cannot pick more than 2 tokens of the same type!"
							);
						}

						if ( pickedCount === 2 && ( data.tokens[ typesPicked[ 0 ] ] ?? 0 ) < 4 ) {
							throw new Error(
								"You cannot pick 2 tokens of the same type " +
								"when less than 4 are available!"
							);
						}

					} else if ( typesPicked.length === 2 ) {
						if ( availableTypes.length < 2 ) {
							throw new Error(
								"You cannot pick 2 different types " +
								"when less than 2 types are available!"
							);
						}

						if ( typesPicked.some( gem => ( input.tokens[ gem ] ?? 0 ) > 1 ) ) {
							throw new Error(
								"You cannot pick more than 1 token of a type " +
								"when picking 2 different types!"
							);
						}

					} else if ( typesPicked.length === 3 ) {
						if ( availableTypes.length < 3 ) {
							throw new Error(
								"You cannot pick 3 different types " +
								"when less than 3 types are available!"
							);
						}

						if ( typesPicked.some( gem => ( input.tokens[ gem ] ?? 0 ) > 1 ) ) {
							throw new Error(
								"You cannot pick more than 1 token of a type " +
								"when picking 3 different types!"
							);
						}

					} else {
						throw new Error( "Invalid number of token types picked!" );
					}

					const totalPlayerTokensBefore = Object.values( player.tokens )
						.reduce( ( acc, val ) => acc + val, 0 );

					const pickedTokens = Object.values( input.tokens )
						.reduce( ( acc, val ) => acc + val, 0 );

					const totalAfterPick = totalPlayerTokensBefore + pickedTokens;

					if ( totalAfterPick <= MAX_TOKENS_IN_HAND ) {
						if ( input.returned ) {
							const anyReturned = Object.values( input.returned )
								.some( v => ( v ?? 0 ) > 0 );
							if ( anyReturned ) {
								throw new Error(
									"You cannot return tokens when your total " +
									"after pick does not exceed 10!"
								);
							}
						}
						return;
					}

					const extraToReturn = totalAfterPick - MAX_TOKENS_IN_HAND;
					const returnedTokens = Object.values( input.returned ?? {} )
						.reduce( ( acc, val ) => acc + val, 0 );
					if ( returnedTokens !== extraToReturn ) {
						throw new Error(
							`You must return exactly ${ extraToReturn } token(s)` +
							`when you exceed the limit!`
						);
					}

					for ( const gem of Object.keys( input.returned ?? {} ).map( g => g as Gem ) ) {
						const ret = input.returned![ gem ] ?? 0;
						const availableAfterPick = player.tokens[ gem ] +
							( input.tokens[ gem ] ?? 0 );
						if ( ret > availableAfterPick ) {
							throw new Error( `You do not have enough ${ gem } tokens to return!` );
						}
					}

					logger.debug( "<< validatePickTokens()" );
				},
				execute: ( { state }, playerId, input ) => {
					logger.debug( ">> handlePickTokens()" );

					const player = state.playerData[ playerId ];

					for ( const gem of Object.keys( input.tokens ).map( g => g as Gem ) ) {
						const take = input.tokens[ gem ] ?? 0;
						if ( take > 0 ) {
							player.tokens[ gem ] += take;
							state.tokens[ gem ] -= take;
						}
					}

					if ( input.returned ) {
						for ( const gem of Object.keys( input.returned ).map( g => g as Gem ) ) {
							const ret = input.returned[ gem ] ?? 0;
							if ( ret > 0 ) {
								player.tokens[ gem ] -= ret;
								state.tokens[ gem ] += ret;
							}
						}
					}

					logger.debug( "<< handlePickTokens()" );
					return state;
				}
			},

			reserveCard: {
				validate: ( { state }, playerId, input ) => {
					logger.debug( ">> validateReserveCard()" );

					const data = state;
					const player = data.playerData[ playerId ];

					if ( player.reserved.length >= MAX_RESERVED ) {
						throw new Error( "You cannot reserve more than 3 cards!" );
					}

					if ( !findCardInOpenCards( input.cardId, data.cards ) ) {
						throw new Error( "Card not found!" );
					}

					if ( input.withGold && data.tokens.gold < 1 ) {
						throw new Error( "Not enough gold tokens available!" );
					}

					if ( input.withGold ) {
						const totalTokens = Object.values( player.tokens )
							.reduce( ( acc, val ) => acc + val, 0 );
						if ( totalTokens + 1 > 10 && !input.returnedToken ) {
							throw new Error(
								"You must return a token when reserving " +
								"with gold exceeds your token limit!"
							);
						}
						if ( totalTokens + 1 <= 10 && input.returnedToken ) {
							throw new Error(
								"You cannot return a token when reserving with" +
								" gold does not exceed your token limit!"
							);
						}
					}

					if ( input.returnedToken ) {
						if ( ( player.tokens[ input.returnedToken ] ?? 0 ) < 1 ) {
							throw new Error(
								`You do not have any ${ input.returnedToken } tokens to return!`
							);
						}
					}

					logger.debug( "<< validateReserveCard()" );
				},
				execute: ( { state }, playerId, input ) => {
					logger.debug( ">> reserveCard()" );

					const player = state.playerData[ playerId ];
					const card = findCardInOpenCards( input.cardId, state.cards )!;

					player.reserved.push( card );
					const cardIdx = state.cards[ card.level ].findIndex( c => c?.id === card.id );
					state.cards[ card.level ][ cardIdx ] = state.decks[ card.level ].shift()!;

					if ( input.withGold ) {
						player.tokens.gold += 1;
						state.tokens.gold -= 1;
					}

					if ( input.returnedToken ) {
						player.tokens[ input.returnedToken ] -= 1;
						state.tokens[ input.returnedToken ] += 1;
					}

					logger.debug( "<< reserveCard()" );
					return state;
				}
			},

			purchaseCard: {
				validate: ( { state }, playerId, input ) => {
					logger.debug( ">> validatePurchaseCard()" );

					const data = state;
					const player = data.playerData[ playerId ];
					let card = findCardInOpenCards( input.cardId, data.cards );
					if ( !card ) {
						card = player.reserved.find( card => card.id === input.cardId );
						if ( !card ) {
							throw new Error( "Card not found!" );
						}
					}

					const totalCost: Cost = {
						diamond: 0,
						sapphire: 0,
						emerald: 0,
						ruby: 0,
						onyx: 0
					};
					Object.keys( card.cost ).map( g => g as keyof Cost ).forEach( gem => {
						const discount = player.cards.filter( c => c.bonus === gem ).length;
						totalCost[ gem ] = Math.max( 0, card.cost[ gem ] - discount );
					} );

					let goldNeeded = 0;
					for ( const gem of Object.keys( totalCost ).map( g => g as keyof Cost ) ) {
						if ( ( input.payment[ gem ] ?? 0 ) > totalCost[ gem ] ) {
							throw new Error( "Overpayment is not allowed!" );
						}
						const diff = totalCost[ gem ] - ( input.payment[ gem ] ?? 0 );
						if ( diff > 0 ) {
							goldNeeded += diff;
						}
					}

					if ( ( input.payment.gold ?? 0 ) < goldNeeded ) {
						throw new Error( "Not enough gold tokens provided!" );
					}

					if ( ( input.payment.gold ?? 0 ) > goldNeeded ) {
						throw new Error( "Overpayment is not allowed!" );
					}

					for ( const gem of Object.keys( input.payment ).map( g => g as Gem ) ) {
						if ( ( input.payment[ gem ] ?? 0 ) > player.tokens[ gem ] ) {
							throw new Error( `You do not have enough ${ gem } tokens!` );
						}
					}

					logger.debug( "<< validatePurchaseCard()" );
				},
				execute: ( { state }, playerId, input ) => {
					logger.debug( ">> purchaseCard()" );

					const player = state.playerData[ playerId ];

					let fromReserved = false;
					let card = findCardInOpenCards( input.cardId, state.cards );
					if ( !card ) {
						card = player.reserved.find( card => card.id === input.cardId )!;
						fromReserved = true;
					}

					if ( fromReserved ) {
						const cardIdx = player.reserved.findIndex( c => c.id === card.id );
						player.cards.push( card );
						player.reserved.splice( cardIdx, 1 );
					} else {
						const cardIdx = state.cards[ card.level ].findIndex(
							c => c && c.id === card.id
						);

						player.cards.push( card );
						state.cards[ card.level ][ cardIdx ] = state.decks[ card.level ].shift()!;
					}

					player.points += card.points;

					Object.keys( input.payment ).map( g => g as Gem ).forEach( gem => {
						player.tokens[ gem ] -= input.payment[ gem ]!;
						state.tokens[ gem ] += input.payment[ gem ]!;
					} );

					for ( const noble of state.nobles ) {
						const meetsRequirements = Object.keys( noble.cost )
							.map( g => g as keyof Cost )
							.every( gem => {
								const ownedCardsOfGem = player.cards.filter(
									card => card.bonus === gem
								);

								return ownedCardsOfGem.length >= noble.cost[ gem ];
							} );

						if ( meetsRequirements ) {
							player.nobles.push( noble );
							player.points += noble.points;
							state.nobles.splice( state.nobles.indexOf( noble ), 1 );
							break;
						}
					}

					logger.debug( "<< purchaseCard()" );
					return state;
				}
			}
		},

		endIf: ( { state, config, context } ) => {
			const { players, turn } = context;
			const isRoundComplete = turn > 0 && turn % players.length === 0;
			return isRoundComplete && players.some( id =>
				state.playerData[ id ]?.points >= config.winningPoints
			);
		}
	} );
}
