import {
	CallbreakBotView,
	CallbreakConfig,
	CallbreakEvent,
	CallbreakState,
	CallbreakView,
	CardPlayedEvent,
	DealDealtEvent,
	DealScoredEvent,
	DeclareWinsInput,
	PlayCardInput,
	ScoreInitializedEvent,
	TrickStartedEvent,
	TrickWonEvent,
	WinnerDecidedEvent,
	WinsDeclaredEvent
} from "@s2h/schema/callbreak";
import { PlayerId } from "@s2h/schema/swish";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import {
	calculateRoundScore,
	createNewDeal,
	determineTrickWinner,
	getPlayableCards,
	PLAYER_COUNT,
	TRICKS_PER_DEAL
} from "@s2h/utils/callbreak";
import { getCardSuit } from "@s2h/utils/cards";
import { botDeclare, botPlayCard } from "./bot";
import { apply } from "./utils.ts";

// --- Engine ----------------------------------------------------------------

export const callbreak = makeEngine( {
	name: "callbreak",
	schemas: {
		state: CallbreakState,
		config: CallbreakConfig,
		events: CallbreakEvent,
		view: CallbreakView,
		moves: {
			declareWins: DeclareWinsInput,
			playCard: PlayCardInput
		}
	},

	apply,

	setup: () => ( { deals: [], scores: {} } ),

	// A game ends once `dealCount` rounds have been scored. A deal is scored
	// when any player's per-deal score is non-zero (matches the old engine).
	endIf: ( { state, config } ) => {
		const completedDeals = state.deals.filter(
			d => Object.values( d.scores ).some( ( s ) => s !== 0 )
		);

		return completedDeals.length >= config.dealCount;
	},

	view: ( { state }, audience ): CallbreakView => {
		const activeDeal = state.deals[ 0 ];
		const previousDeal = state.deals[ 1 ];
		const lastCompletedTrick = previousDeal?.tricks[ 0 ];

		if ( !activeDeal ) {
			return audience._tag === "swish/Table"
				? { scores: state.scores, winner: state.winner }
				: {
					scores: state.scores,
					winner: state.winner,
					playerId: audience.id,
					hand: []
				};
		}

		const { hands, ...deal } = activeDeal;
		const view = {
			activeDeal: deal,
			scores: state.scores,
			lastCompletedTrick,
			winner: state.winner
		};

		return audience._tag === "swish/Table" ? view : {
			...view,
			playerId: audience.id,
			hand: hands[ audience.id ]
		};
	},

	hooks: {
		// Seed each joining player's cumulative score at 0.
		onJoin: ( _data, playerId ) => [ ScoreInitializedEvent.make( { playerId } ) ],

		// The winner is the player with the highest cumulative score.
		onEnd: ( { state, context } ) => {
			const winner = context.players.reduce( ( best, pid ) =>
				( state.scores[ pid ] ?? 0 ) > ( state.scores[ best ] ?? 0 ) ? pid : best
			);
			return [ WinnerDecidedEvent.make( { winner } ) ];
		},

		// If the previous trick has been won, open a new trick led by the winner
		// before the next card is played. Naturally no-ops outside PLAYING since
		// `state.deals[ 0 ]?.tricks[ 0 ]?.winner` is falsy while DECLARING.
		beforeMove: ( { state } ) => {
			const activeTrick = state.deals[ 0 ]?.tricks[ 0 ];
			if ( activeTrick?.winner ) {
				return [ TrickStartedEvent.make( { leadPlayer: activeTrick.winner } ) ];
			}

			return [];
		}
	},

	moves: {
		declareWins: {
			phase: "DECLARING",

			validate: ( { state }, playerId, input ) => {
				const activeDeal = state.deals[ 0 ];
				if ( !activeDeal || activeDeal.id !== input.dealId ) {
					return new InvalidMove( { move: "declareWins", reason: "Active Deal Not Found!" } );
				}

				if ( ( activeDeal.declarations[ playerId ] ?? 0 ) > 0 ) {
					return new InvalidMove( { move: "declareWins", reason: "Already declared wins!" } );
				}

				return;
			},

			execute: ( _data, playerId, input ) => [
				WinsDeclaredEvent.make( { playerId, wins: input.wins } )
			]
		},

		playCard: {
			phase: "PLAYING",

			validate: ( { state, config }, playerId, input ) => {
				const activeDeal = state.deals[ 0 ];
				if ( !activeDeal || activeDeal.id !== input.dealId ) {
					return new InvalidMove( {
						move: "playCard",
						reason: "Active Deal Not Found!"
					} );
				}

				const activeTrick = activeDeal.tricks[ 0 ];
				if ( !activeTrick ) {
					return new InvalidMove( {
						move: "playCard",
						reason: "Active Trick Not Found!"
					} );
				}

				if ( activeTrick.cards[ playerId ] ) {
					return new InvalidMove( {
						move: "playCard",
						reason: "Already played card!"
					} );
				}

				const hand = activeDeal.hands[ playerId ] ?? [];
				if ( !hand.includes( input.cardId ) ) {
					return new InvalidMove( {
						move: "playCard",
						reason: "Card not in hand!"
					} );
				}

				const playable = getPlayableCards( [ ...hand ], config.trumpSuit, activeTrick );
				if ( !playable.includes( input.cardId ) ) {
					return new InvalidMove( {
						move: "playCard",
						reason: "Card cannot be played!"
					} );
				}

				return;
			},
			execute: ( { state, config, context }, playerId, input ) => {
				const events: Array<CallbreakEvent> = [
					CardPlayedEvent.make( { playerId, cardId: input.cardId } )
				];

				const activeDeal = state.deals[ 0 ]!;
				const activeTrick = activeDeal.tricks[ 0 ]!;

				// This card completes the trick — decide the winner now. The
				// projected trick includes the just-played card + resolved suit.
				if ( Object.keys( activeTrick.cards ).length + 1 >= PLAYER_COUNT ) {
					const projected = {
						...activeTrick,
						cards: { ...activeTrick.cards, [ playerId ]: input.cardId },
						suit: activeTrick.suit ?? getCardSuit( input.cardId )
					};

					const winner = determineTrickWinner(
						projected,
						config.trumpSuit,
						[ ...context.players ]
					);

					events.push( TrickWonEvent.make( { winner } ) );
				}

				return events;
			}
		}
	},


	/**
	 * Pick the bot's move from a game snapshot. Dispatches on the current phase
	 * (`context.phase`) and rebuilds a `CallbreakBotView` (exactly `shared & player`)
	 * for the AI helpers in ./bot.
	 */
	botMove: ( snapshot ) => {
		const { playerId, hand } = snapshot.view;
		if ( !playerId || !hand ) {
			return;
		}

		const view = CallbreakBotView.make( { ...snapshot.view, playerId, hand } );
		if ( snapshot.context.phase === "DECLARING" ) {
			return {
				moveType: "declareWins",
				input: { wins: botDeclare( view, snapshot.config ), dealId: view.activeDeal!.id }
			};
		}

		return {
			moveType: "playCard",
			input: {
				cardId: botPlayCard( view, snapshot.config ),
				dealId: view.activeDeal!.id
			}
		};
	},

	initialPhase: "DECLARING",

	phases: {
		DECLARING: {
			moves: [ "declareWins" ],

			// Deal a fresh round. Nondeterministic shuffle happens here and the
			// exact dealt deal is captured in `DealDealt` for exact replay.
			onEnter: ( { state, context } ) => {
				const previousDeal = state.deals[ 0 ];
				let startingPlayer: PlayerId;
				if ( previousDeal ) {
					const startIdx = context.players.indexOf( previousDeal.startingPlayer );
					startingPlayer = context.players[ ( startIdx + 1 ) % context.players.length ]!;
				} else {
					startingPlayer = context.players[ 0 ]!;
				}

				const deal = createNewDeal( [ ...context.players ], startingPlayer );
				return [ DealDealtEvent.make( { deal } ) ];
			},

			resolveStartingPlayer: ( { state } ) => state.deals[ 0 ]!.startingPlayer,

			resolveNextPlayer: ( { state, context } ) => {
				const activeDeal = state.deals[ 0 ]!;
				const startIdx = context.players.indexOf( activeDeal.startingPlayer );
				for ( let i = 0; i < context.players.length; i++ ) {
					const pid = context.players[ ( startIdx + i ) % context.players.length ]!;
					if ( ( activeDeal.declarations[ pid ] ?? 0 ) === 0 ) {
						return pid;
					}
				}

				return activeDeal.startingPlayer;
			},

			endIf: ( { state, context } ) => {
				const activeDeal = state.deals[ 0 ]!;
				return context.players.every( ( pid ) => ( activeDeal.declarations[ pid ] ?? 0 ) > 0 );
			},

			resolveNextPhase: () => "PLAYING"
		},

		PLAYING: {
			moves: [ "playCard" ],

			// Start the first trick of the round, led by the deal's starter.
			onEnter: ( { state } ) => [
				TrickStartedEvent.make( { leadPlayer: state.deals[ 0 ]!.startingPlayer } )
			],

			resolveStartingPlayer: ( { state } ) => state.deals[ 0 ]!.startingPlayer,

			resolveNextPlayer: ( { state, context } ) => {
				const activeTrick = state.deals[ 0 ]?.tricks[ 0 ];
				if ( !activeTrick ) {
					return context.players[ 0 ]!;
				}

				if ( activeTrick.winner ) {
					return activeTrick.winner;
				}

				const played = Object.keys( activeTrick.cards );
				if ( played.length === 0 ) {
					return activeTrick.leadPlayer;
				}

				const lastPlayer = played[ played.length - 1 ]!;
				const lastIdx = context.players.indexOf( lastPlayer as PlayerId );
				return context.players[ ( lastIdx + 1 ) % PLAYER_COUNT ]!;
			},

			endIf: ( { state } ) => {
				const activeDeal = state.deals[ 0 ]!;
				const completed = activeDeal.tricks.filter( ( t ) => !!t.winner ).length;
				return completed >= TRICKS_PER_DEAL;
			},

			// Score the finished round: per-player round score + accumulate.
			onExit: ( { state, context } ) => {
				const activeDeal = state.deals[ 0 ]!;
				const scores: Record<string, number> = {};
				for ( const pid of context.players ) {
					scores[ pid ] = calculateRoundScore(
						activeDeal.declarations[ pid ] ?? 0,
						activeDeal.wins[ pid ] ?? 0
					);
				}

				return [ DealScoredEvent.make( { scores } ) ];
			},

			resolveNextPhase: () => "DECLARING"
		}
	}
} );
