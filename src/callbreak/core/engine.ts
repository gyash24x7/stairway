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
import { CARD_SUITS, getCardSuit } from "@/shared/utils/cards";

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

			onStart: ( { state, context } ) => {
				state.deals.unshift( createNewDeal( context.players ) );
				return state;
			},

			afterMove: ( { state, config, context }, _playerId, _moveType ) => {
				const activeDeal = state.deals[ 0 ];
				if ( !activeDeal ) {
					return state;
				}

				const activeTrick = activeDeal.tricks[ 0 ];
				if ( !activeTrick?.winner ) {
					return state;
				}

				const completedTricks = activeDeal.tricks.filter( t => !!t.winner ).length;

				if ( completedTricks >= TRICKS_PER_DEAL ) {
					for ( const pid of context.players ) {
						const score = calculateRoundScore( activeDeal.declarations[ pid ], activeDeal.wins[ pid ] );
						activeDeal.scores[ pid ] = score;
						state.scores[ pid ] = ( state.scores[ pid ] ?? 0 ) + score;
					}

					const completedDeals = state.deals.filter( d =>
						Object.values( d.scores ).some( s => s !== 0 )
					).length;

					if ( completedDeals < config.dealCount ) {
						const startIdx = context.players.indexOf( activeDeal.startingPlayer );
						const nextStarter = context.players[ ( startIdx + 1 ) % context.players.length ];
						state.deals.unshift( createNewDeal( context.players, nextStarter ) );
					}
				} else {
					activeDeal.tricks.unshift( emptyTrick( activeTrick.winner ) );
				}

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

		moves: {
			declareWins: {
				validate: ( { state }, playerId, input: DeclareWinsInput ) => {
					this.logger.debug( ">> validateDeclareWins()" );

					const activeDeal = state.deals[ 0 ];
					if ( !activeDeal || activeDeal.id !== input.dealId ) {
						throw new Error( "Active Deal Not Found!" );
					}

					if ( activeDeal.phase !== "calling" ) {
						throw new Error( "Invalid phase!" );
					}

					if ( activeDeal.declarations[ playerId ] > 0 ) {
						throw new Error( "Already declared wins!" );
					}

					this.logger.debug( "<< validateDeclareWins()" );
				},
				execute: ( { state, context }, playerId, input: DeclareWinsInput ) => {
					this.logger.debug( ">> declareWins()" );

					const activeDeal = state.deals[ 0 ];

					activeDeal.declarations[ playerId ] = input.wins;

					const allDeclared = context.players.every( pid => activeDeal.declarations[ pid ] > 0 );

					if ( allDeclared ) {
						activeDeal.phase = "playing";
						activeDeal.tricks.unshift( emptyTrick( activeDeal.startingPlayer ) );
					}

					this.logger.debug( "<< declareWins()" );
					return state;
				}
			},

			playCard: {
				validate: ( { state, config }, playerId, input: PlayCardInput ) => {
					this.logger.debug( ">> validatePlayCard()" );

					const activeDeal = state.deals[ 0 ];
					if ( !activeDeal || activeDeal.id !== input.dealId ) {
						throw new Error( "Active Deal Not Found!" );
					}

					if ( activeDeal.phase !== "playing" ) {
						throw new Error( "Invalid phase!" );
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

					this.logger.debug( "<< validatePlayCard()" );
				},
				execute: ( { state, config, context }, playerId, input: PlayCardInput ) => {
					this.logger.debug( ">> playCard()" );

					const activeDeal = state.deals[ 0 ];
					const activeTrick = activeDeal.tricks[ 0 ];

					activeDeal.hands[ playerId ] = activeDeal.hands[ playerId ].filter( c => c !== input.cardId );
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

					this.logger.debug( "<< playCard()" );
					return state;
				}
			}
		},

		botMove: ( { state, config } ) => {
			if ( state.activeDeal?.phase === "calling" ) {
				const wins = botDeclare( state, config );
				return { moveType: "declareWins", input: { gameId: "", wins, dealId: state.activeDeal.id } };
			}

			const cardId = botPlayCard( state, config );
			return { moveType: "playCard", input: { gameId: "", cardId, dealId: state.activeDeal!.id } };
		},

		getNextPlayer: ( { state, context } ) => {
			const activeDeal = state.deals[ 0 ];
			if ( !activeDeal ) {
				return context.players[ 0 ];
			}

			if ( activeDeal.phase === "calling" ) {
				const startIdx = context.players.indexOf( activeDeal.startingPlayer );
				for ( let i = 0; i < context.players.length; i++ ) {
					const pid = context.players[ ( startIdx + i ) % context.players.length ];
					if ( activeDeal.declarations[ pid ] === 0 ) {
						return pid;
					}
				}
				return activeDeal.startingPlayer;
			}

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

		endIf: ( { state, config } ) => {
			const completedDeals = state.deals.filter( d =>
				Object.values( d.scores ).some( s => s !== 0 )
			).length;

			return completedDeals < config.dealCount;
		}
	};

	protected getInitialState(): { state: CallbreakData; config: CallbreakConfig } {
		return {
			config: { trumpSuit: CARD_SUITS.SPADES, dealCount: 5, autoStart: true, playerCount: 4 },
			state: { deals: [], scores: {} }
		};
	}
}
