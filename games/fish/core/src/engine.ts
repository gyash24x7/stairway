import { GAME_NAME } from "./utils";
import {
	detectTeammateSignals,
	suggestAsks,
	suggestBooks,
	suggestClaims,
	suggestTransfers
} from "./bot";
import type {
	FishConfig,
	FishData,
	FishMoves,
	FishPlayerView,
	FishSharedView,
	Metrics
} from "./types";
import {
	getBookForCard,
	getCardsOfBook,
	getClaimedBooks,
	getOpponents,
	getTeammates
} from "./utils";
import { AbstractGameEngine } from "@s2h/engine";
import type { PlayerId } from "@s2h/engine/types";
import { remove } from "@s2h/shared/utils/array";
import {
	CARD_RANKS,
	type CardId,
	generateDeck,
	generateHands,
	getCardRank
} from "@s2h/shared/utils/cards";
import { generateId } from "@s2h/shared/utils/generator";

const DEFAULT_METRICS: Metrics = {
	totalAsks: 0,
	cardsGiven: 0,
	cardsTaken: 0,
	totalClaims: 0,
	successfulClaims: 0
};

/**
 * Durable Object game engine for Fish (Literature), a team-based card game.
 * Uses a phased structure with TEAM_CONFIG (team assignment)
 * and PLAY (asking, claiming, transferring) phases.
 * Supports bot players with signal detection and strategic asking/claiming AI.
 */
export class FishEngine extends AbstractGameEngine<
	FishData,
	FishMoves,
	FishConfig,
	FishSharedView,
	FishPlayerView
> {

	public static readonly NAME = GAME_NAME;

	protected readonly structure = this.defineStructure( {
		name: FishEngine.NAME,

		sharedView: ( { state } ) => {
			const { hands, ...rest } = state;
			return rest;
		},

		playerView: ( { state }, playerId ) => {
			return { playerId, hand: state.hands[ playerId ] ?? [] };
		},

		setup: () => ( {
			playerData: {},
			teams: {},
			hands: {},
			cardCounts: {},
			cardLocations: {},
			askHistory: [],
			claimHistory: [],
			transferHistory: []
		} ),

		hooks: {
			onJoin: ( { state }, playerId ) => {
				state.playerData[ playerId ] = { teamId: "", metrics: { ...DEFAULT_METRICS } };
				return state;
			},

			onEnd: ( { state } ) => {
				const teamIds = Object.keys( state.teams );
				state.winningTeam = teamIds.reduce( ( best, tid ) =>
					state.teams[ tid ].score > state.teams[ best ].score ? tid : best
				);

				return state;
			}
		},

		endIf: ( { state, config } ) => {
			const totalBooks = config.books.length;
			const claimedCount = getClaimedBooks( state ).length;
			return claimedCount === totalBooks;
		},

		initialPhase: "TEAM_CONFIG",

		phases: {
			TEAM_CONFIG: this.definePhase<Pick<FishMoves, "createTeams">>( {
				moves: {
					createTeams: {
						canMove: ( { context }, playerId ) => context.currentPlayer === playerId,
						validate: ( { state, config }, _playerId, input ) => {
							if ( Object.keys( state.teams ).length > 0 ) {
								throw new Error( "Teams have already been created!" );
							}

							const teamCount = Object.keys( input.teams ).length;
							if ( teamCount !== config.teamCount ) {
								throw new Error( "Team count does not match the game config!" );
							}

							const playersSpecified = new Set( Object.values( input.teams ).flat() );
							if ( playersSpecified.size !== config.playerCount ) {
								throw new Error( "Not all players are divided into teams!" );
							}

							const playersPerTeam = config.playerCount / teamCount;
							for ( const [ teamName, playerIds ] of Object.entries( input.teams ) ) {
								if ( playerIds.length !== playersPerTeam ) {
									throw new Error( `Invalid number of players in team ${ teamName }!` );
								}

								for ( const pid of playerIds ) {
									if ( !state.playerData[ pid ] ) {
										throw new Error( `Player ${ pid } is not part of the game!` );
									}
								}
							}
						},
						execute: ( { state }, _playerId, input ) => {
							Object.entries( input.teams ).forEach( ( [ name, members ] ) => {
								const id = generateId();
								state.teams[ id ] = { id, name, members, score: 0, booksWon: [] };
								members.forEach( playerId => {
									state.playerData[ playerId ].teamId = id;
								} );
							} );

							return state;
						}
					}
				},

				resolveNextPlayer: ( { context } ) => context.currentPlayer,

				endIf: ( { state } ) => Object.keys( state.teams ).length > 0,

				resolveNextPhase: () => "PLAY"
			} ),

			PLAY: this.definePhase<Pick<FishMoves, "askCard" | "claimBook" | "transferTurn">>( {
				onEnter: ( { state, config, context } ) => {
					let deck = generateDeck();
					if ( config.deckType === 48 ) {
						deck = remove( card => getCardRank( card ) === CARD_RANKS.SEVEN, deck );
					}

					const hands = generateHands( deck, context.players.length );
					for ( let i = 0; i < context.players.length; i++ ) {
						state.hands[ context.players[ i ] ] = hands[ i ];
						state.cardCounts[ context.players[ i ] ] = hands[ i ].length;
					}

					state.cardLocations = deck.reduce(
						( acc, card ) => {
							acc[ card ] = context.players;
							return acc;
						},
						{} as Partial<Record<CardId, PlayerId[]>>
					);

					return state;
				},

				moves: {
					askCard: {
						validate: ( { state, config }, playerId, input ) => {
							const hand = state.hands[ playerId ];
							if ( !hand || hand.length === 0 ) {
								throw new Error( "You have no cards! Transfer your turn instead." );
							}

							const opponents = getOpponents( state.teams, playerId );
							if ( !opponents.includes( input.from ) ) {
								throw new Error( "You can only ask opponents for cards!" );
							}

							const book = getBookForCard( input.cardId, config.type );
							const hasCardFromBook = hand.some( c => getBookForCard( c, config.type ) === book );
							if ( !hasCardFromBook ) {
								throw new Error( "You must hold atleast 1 card from the book!" );
							}

							if ( hand.includes( input.cardId ) ) {
								throw new Error( "You already have this card!" );
							}

							if ( getClaimedBooks( state ).includes( book ) ) {
								throw new Error( "This book has already been claimed!" );
							}
						},
						execute: ( { state }, playerId, input ) => {
							const opponentHand = state.hands[ input.from ];
							const hasCard = opponentHand.includes( input.cardId );

							if ( hasCard ) {
								state.hands[ input.from ] =
									opponentHand.filter( c => c !== input.cardId );
								state.cardCounts[ input.from ]--;
								state.playerData[ input.from ].metrics.cardsGiven++;

								state.hands[ playerId ].push( input.cardId );
								state.cardCounts[ playerId ]++;
								state.playerData[ playerId ].metrics.cardsTaken++;
							}

							state.playerData[ playerId ].metrics.totalAsks++;
							state.lastMoveType = "ask";

							state.askHistory.unshift( {
								success: hasCard,
								playerId,
								from: input.from,
								cardId: input.cardId,
								timestamp: Date.now()
							} );

							const possibleOwners = state.cardLocations[ input.cardId ]!;
							state.cardLocations[ input.cardId ] = hasCard
								? [ playerId ]
								: remove( p => p === input.from || p === playerId, possibleOwners );

							if ( hasCard && state.cardCounts[ input.from ] <= 0 ) {
								for ( const cid of Object.keys( state.cardLocations ) as CardId[] ) {
									const owners = state.cardLocations[ cid ];
									if ( owners && owners.includes( input.from ) ) {
										state.cardLocations[ cid ] = owners.filter( pid => pid !== input.from );
									}
								}
							}

							return state;
						}
					},

					claimBook: {
						validate: ( { state, config, context }, _playerId, input ) => {
							const claimedCards = Object.keys( input.claim ) as CardId[];
							if ( claimedCards.length === 0 ) {
								throw new Error( "Claim cannot be empty!" );
							}

							const books = new Set( claimedCards.map( c => getBookForCard( c, config.type ) ) );
							if ( books.size !== 1 ) {
								throw new Error( "All cards must belong to the same book!" );
							}

							const book = [ ...books ][ 0 ];

							if ( getClaimedBooks( state ).includes( book ) ) {
								throw new Error( "This book has already been claimed!" );
							}

							const allBookCards = getCardsOfBook( book, config.type );
							if ( claimedCards.length !== allBookCards.length ) {
								throw new Error( `Must claim all ${ allBookCards.length } cards in the book!` );
							}

							for ( const card of allBookCards ) {
								if ( !claimedCards.includes( card ) ) {
									throw new Error( `Missing card ${ card } from claim!` );
								}
							}

							for ( const pid of Object.values( input.claim ) ) {
								if ( pid && !context.players.includes( pid ) ) {
									throw new Error( `Player ${ pid } is not in this game!` );
								}
							}
						},

						execute: ( { state, config, context }, playerId, input ) => {
							const claimedCards = Object.keys( input.claim ) as CardId[];
							const book = getBookForCard( claimedCards[ 0 ], config.type );
							const allBookCards = getCardsOfBook( book, config.type );
							const playerTeamId = state.playerData[ playerId ].teamId;

							const correctClaim: Partial<Record<CardId, PlayerId>> = {};
							for ( const card of allBookCards ) {
								for ( const pid of context.players ) {
									if ( state.hands[ pid ]?.includes( card ) ) {
										correctClaim[ card ] = pid;
										break;
									}
								}
							}

							const isCorrect = allBookCards.every( card =>
								input.claim[ card ] === correctClaim[ card ]
							);

							allBookCards.forEach( card => {
								delete state.cardLocations[ card ];
								state.cardCounts[ correctClaim[ card ]! ]--;
							} );

							const emptyPlayers = new Set(
								Object.keys( state.cardCounts ).filter( pid => state.cardCounts[ pid ] <= 0 )
							);

							if ( emptyPlayers.size > 0 ) {
								for ( const cardId of Object.keys( state.cardLocations ) as CardId[] ) {
									const owners = state.cardLocations[ cardId ];
									if ( owners ) {
										const filtered = owners.filter( pid => !emptyPlayers.has( pid ) );
										if ( filtered.length > 0 ) {
											state.cardLocations[ cardId ] = filtered;
										}
									}
								}
							}

							const winningTeamId = isCorrect
								? playerTeamId
								: Object.keys( state.teams ).find( tid => tid !== playerTeamId )!;

							state.teams[ winningTeamId ].booksWon.push( book );
							state.teams[ winningTeamId ].score++;

							for ( const pid of context.players ) {
								state.hands[ pid ] = state.hands[ pid ].filter(
									c => !allBookCards.includes( c )
								);
							}

							state.playerData[ playerId ].metrics.totalClaims++;
							if ( isCorrect ) {
								state.playerData[ playerId ].metrics.successfulClaims++;
							}

							state.lastMoveType = "claim";

							state.claimHistory.unshift( {
								success: isCorrect,
								playerId,
								book,
								correctClaim,
								actualClaim: input.claim,
								timestamp: Date.now()
							} );

							return state;
						}
					},

					transferTurn: {
						validate: ( { state }, playerId, input ) => {
							const lastClaimWasSuccessful = state.lastMoveType === "claim"
								&& state.claimHistory.length > 0
								&& state.claimHistory[ 0 ].success
								&& state.claimHistory[ 0 ].playerId === playerId;

							if ( !lastClaimWasSuccessful ) {
								throw new Error( "You can only transfer turn after a successful claim!" );
							}

							const teamMates = getTeammates( state.teams, playerId );
							if ( !teamMates.includes( input.transferTo ) ) {
								throw new Error( "You can only transfer to a teammate!" );
							}

							if ( state.hands[ input.transferTo ]?.length === 0 ) {
								throw new Error( "Cannot transfer to a teammate with no cards!" );
							}
						},

						execute: ( { state }, playerId, input ) => {
							state.lastMoveType = "transfer";
							state.transferHistory.unshift( {
								playerId,
								transferTo: input.transferTo,
								timestamp: Date.now()
							} );

							return state;
						}
					}
				},

				resolveNextPlayer: ( { state, context } ) => {
					let nextPlayer: PlayerId;

					switch ( state.lastMoveType ) {
						case "ask": {
							const lastAsk = state.askHistory[ 0 ];
							nextPlayer = lastAsk.success ? lastAsk.playerId : lastAsk.from;
							break;
						}

						case "claim": {
							const lastClaim = state.claimHistory[ 0 ];
							if ( lastClaim.success ) {
								nextPlayer = lastClaim.playerId;
								break;
							}

							const opponents = getOpponents( state.teams, lastClaim.playerId );
							nextPlayer = opponents.find( pid => state.hands[ pid ]?.length > 0 )
								?? context.players[ 0 ];

							break;
						}

						case "transfer": {
							const lastTransfer = state.transferHistory[ 0 ];
							nextPlayer = lastTransfer.transferTo;
							break;
						}

						default: {
							nextPlayer = context.currentPlayer;
						}
					}

					if ( state.hands[ nextPlayer ]?.length === 0 ) {
						const teammates = getTeammates( state.teams, nextPlayer );
						const teammateWithCards = teammates.find( pid => state.hands[ pid ]?.length > 0 );
						if ( teammateWithCards ) {
							return teammateWithCards;
						}

						return context.players.find( pid => state.hands[ pid ]?.length > 0 ) ?? nextPlayer;
					}

					return nextPlayer;
				},

				endIf: () => false,

				resolveNextPhase: () => "PLAY",

				botMove: ( { state, config, context } ) => {
					const signals = detectTeammateSignals( state, config );
					const weightedBooks = suggestBooks( state, config, signals );

					const isLastMoveSuccessfulClaim = state.lastMoveType === "claim"
						&& state.claimHistory[ 0 ]?.success
						&& state.claimHistory[ 0 ]?.playerId === context.currentPlayer;

					if ( isLastMoveSuccessfulClaim ) {
						const weightedTransfers = suggestTransfers( state, config );

						if ( weightedTransfers.length > 0 ) {
							const transferTo = weightedTransfers[ 0 ].transferTo;
							return { moveType: "transferTurn" as const, input: { transferTo, gameId: "" } };
						}

						const teammates = getTeammates( state.teams, state.playerId );
						const transferTo = teammates.find( pid => state.cardCounts[ pid ] > 0 );
						if ( transferTo ) {
							return { moveType: "transferTurn" as const, input: { transferTo, gameId: "" } };
						}
					}

					const weightedClaims = suggestClaims( weightedBooks, state, config, signals );

					if ( weightedClaims.length > 0 ) {
						const claim = weightedClaims[ 0 ].claim;
						return { moveType: "claimBook" as const, input: { claim, gameId: "" } };
					}

					const weightedAsks = suggestAsks( weightedBooks, state, config, signals );
					if ( weightedAsks.length > 0 ) {
						const { playerId, cardId } = weightedAsks[ 0 ];
						return { moveType: "askCard" as const, input: { from: playerId, cardId, gameId: "" } };
					}

					const fallbackBook = weightedBooks[ 0 ];
					if ( fallbackBook ) {
						const cardsInBook = getCardsOfBook( fallbackBook.book, config.type );
						const claim: Partial<Record<CardId, PlayerId>> = {};
						for ( const cardId of cardsInBook ) {
							const owners = state.cardLocations[ cardId ] ?? context.players;
							claim[ cardId ] = owners[ 0 ];
						}
						return { moveType: "claimBook" as const, input: { claim, gameId: "" } };
					}

					throw new Error( `Bot ${ context.currentPlayer } has no available moves` );
				}
			} )
		}
	} );

}
