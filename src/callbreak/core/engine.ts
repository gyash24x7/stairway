import { botDeclare, botPlayCard } from "@/callbreak/core/bot";
import type {
	CallbreakConfig,
	CallbreakData,
	CallbreakMoves,
	CallbreakPlayerView,
	DeclareWinsInput,
	PlayCardInput
} from "@/callbreak/core/types";
import {
	calculateRoundScore,
	createNewDeal,
	determineTrickWinner,
	emptyTrick,
	getPlayableCards,
	PLAYER_COUNT,
	TRICKS_PER_DEAL
} from "@/callbreak/core/utils";
import { AbstractGameEngine } from "@/shared/engine/engine";
import type { GameStructure } from "@/shared/engine/types";
import { getCardSuit } from "@/shared/utils/cards";

export class CallbreakEngine extends AbstractGameEngine<CallbreakData, CallbreakMoves, CallbreakConfig, CallbreakPlayerView> {

	public static readonly NAME = "callbreak";

	protected readonly structure: GameStructure<CallbreakData, CallbreakMoves, CallbreakConfig, CallbreakPlayerView> = {
		name: CallbreakEngine.NAME,

		playerView: ( { state }, playerId ): CallbreakPlayerView => {
			const activeDeal = state.deals[ 0 ];
			if ( activeDeal ) {
				const { hands, ...deal } = activeDeal;
				return { activeDeal: deal, scores: state.scores, hand: hands[ playerId ], playerId };
			}

			return { scores: state.scores, hand: [], playerId };
		},

		setup: ( _config: CallbreakConfig ): CallbreakData => ( { deals: [], scores: {} } ),

		hooks: {
			onJoin: ( { state }, playerId ) => {
				state.scores[ playerId ] = 0;
				return state;
			},

			onEnd: ( { state, context } ) => {
				const players = context.players;
				state.winner = players.reduce( ( best, pid ) =>
					( state.scores[ pid ] ?? 0 ) > ( state.scores[ best ] ?? 0 ) ? pid : best
				);

				return state;
			}
		},

		endIf: ( { state, config } ) => {
			const completedDeals = state.deals.filter( d =>
				Object.values( d.scores ).some( s => s !== 0 )
			).length;

			return completedDeals >= config.dealCount;
		},

		initialPhase: "DECLARING",

		phases: {
			DECLARING: {
				onEnter: ( { state, context } ) => {
					const previousDeal = state.deals[ 0 ];
					let startingPlayer: string;

					if ( previousDeal ) {
						const startIdx = context.players.indexOf( previousDeal.startingPlayer );
						startingPlayer = context.players[ ( startIdx + 1 ) % context.players.length ];
					} else {
						startingPlayer = context.players[ 0 ];
					}

					state.deals.unshift( createNewDeal( context.players, startingPlayer ) );
					return state;
				},

				resolveStartingPlayer: ( { state } ) => state.deals[ 0 ].startingPlayer,

				moves: {
					declareWins: {
						validate: ( { state }, playerId, input: DeclareWinsInput ) => {
							const activeDeal = state.deals[ 0 ];
							if ( !activeDeal || activeDeal.id !== input.dealId ) {
								throw new Error( "Active Deal Not Found!" );
							}

							if ( activeDeal.declarations[ playerId ] > 0 ) {
								throw new Error( "Already declared wins!" );
							}
						},
						execute: ( { state }, playerId, input: DeclareWinsInput ) => {
							const activeDeal = state.deals[ 0 ];
							activeDeal.declarations[ playerId ] = input.wins;
							return state;
						}
					}
				},

				resolveNextPlayer: ( { state, context } ) => {
					const activeDeal = state.deals[ 0 ];
					const startIdx = context.players.indexOf( activeDeal.startingPlayer );
					for ( let i = 0; i < context.players.length; i++ ) {
						const pid = context.players[ ( startIdx + i ) % context.players.length ];
						if ( activeDeal.declarations[ pid ] === 0 ) {
							return pid;
						}
					}
					return activeDeal.startingPlayer;
				},

				endIf: ( { state, context } ) => {
					const activeDeal = state.deals[ 0 ];
					return context.players.every( pid => activeDeal.declarations[ pid ] > 0 );
				},

				resolveNextPhase: () => "PLAYING",

				botMove: ( { state, config } ) => {
					const wins = botDeclare( state, config );
					return { moveType: "declareWins", input: { gameId: "", wins, dealId: state.activeDeal!.id } };
				}
			},

			PLAYING: {
				onEnter: ( { state } ) => {
					const activeDeal = state.deals[ 0 ];
					activeDeal.tricks.unshift( emptyTrick( activeDeal.startingPlayer ) );
					return state;
				},

				resolveStartingPlayer: ( { state } ) => state.deals[ 0 ].startingPlayer,

				moves: {
					playCard: {
						validate: ( { state, config }, playerId, input: PlayCardInput ) => {
							const activeDeal = state.deals[ 0 ];
							if ( !activeDeal || activeDeal.id !== input.dealId ) {
								throw new Error( "Active Deal Not Found!" );
							}

							const activeTrick = activeDeal.tricks[ 0 ];
							if ( !activeTrick ) {
								throw new Error( "Active Trick Not Found!" );
							}

							if ( !!activeTrick.cards[ playerId ] ) {
								throw new Error( "Already played card!" );
							}

							const hand = activeDeal.hands[ playerId ];
							if ( !hand.includes( input.cardId ) ) {
								throw new Error( "Card not in hand!" );
							}

							const playableCards = getPlayableCards( hand, config.trumpSuit, activeTrick );
							if ( !playableCards.includes( input.cardId ) ) {
								throw new Error( "Card cannot be played!" );
							}
						},
						execute: ( { state, config, context }, playerId, input: PlayCardInput ) => {
							const activeDeal = state.deals[ 0 ];
							const activeTrick = activeDeal.tricks[ 0 ];

							activeDeal.hands[ playerId ] =
								activeDeal.hands[ playerId ].filter( c => c !== input.cardId );
							activeTrick.cards[ playerId ] = input.cardId;

							if ( !activeTrick.suit ) {
								activeTrick.suit = getCardSuit( input.cardId );
							}

							const trickCardCount = Object.keys( activeTrick.cards ).length;

							if ( trickCardCount >= PLAYER_COUNT ) {
								const winner = determineTrickWinner( activeTrick, config.trumpSuit, context.players );
								activeTrick.winner = winner;
								activeDeal.wins[ winner ]++;
							}

							return state;
						}
					}
				},

				hooks: {
					afterMove: ( { state } ) => {
						const activeDeal = state.deals[ 0 ];
						const activeTrick = activeDeal.tricks[ 0 ];

						if ( !activeTrick?.winner ) {
							return state;
						}

						const completedTricks = activeDeal.tricks.filter( t => !!t.winner ).length;
						if ( completedTricks < TRICKS_PER_DEAL ) {
							activeDeal.tricks.unshift( emptyTrick( activeTrick.winner ) );
						}

						return state;
					}
				},

				resolveNextPlayer: ( { state, context } ) => {
					const activeDeal = state.deals[ 0 ];
					const activeTrick = activeDeal.tricks[ 0 ];

					if ( !activeTrick ) {
						return context.players[ 0 ];
					}

					if ( activeTrick.winner ) {
						return activeTrick.winner;
					}

					const cardsPlayed = Object.keys( activeTrick.cards ).length;
					if ( cardsPlayed === 0 ) {
						return activeTrick.leadPlayer;
					}

					const lastPlayer = Object.keys( activeTrick.cards ).pop()!;
					const lastIdx = context.players.indexOf( lastPlayer );
					return context.players[ ( lastIdx + 1 ) % PLAYER_COUNT ];
				},

				endIf: ( { state } ) => {
					const activeDeal = state.deals[ 0 ];
					const completedTricks = activeDeal.tricks.filter( t => !!t.winner ).length;
					return completedTricks >= TRICKS_PER_DEAL;
				},

				onExit: ( { state, context } ) => {
					const activeDeal = state.deals[ 0 ];
					for ( const pid of context.players ) {
						const score = calculateRoundScore( activeDeal.declarations[ pid ], activeDeal.wins[ pid ] );
						activeDeal.scores[ pid ] = score;
						state.scores[ pid ] = ( state.scores[ pid ] ?? 0 ) + score;
					}
					return state;
				},

				resolveNextPhase: () => "DECLARING",

				botMove: ( { state, config } ) => {
					const cardId = botPlayCard( state, config );
					return { moveType: "playCard", input: { gameId: "", cardId, dealId: state.activeDeal!.id } };
				}
			}
		}
	};
}
