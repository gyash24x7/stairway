import { castDraft, produce } from "immer";

import {
	CALLBREAK_BOT_DELAY_MILLIS,
	CALLBREAK_DEAL_COUNTS,
	CALLBREAK_MIN_DECLARATION,
	CALLBREAK_PLAYER_COUNT,
	CALLBREAK_TRICKS_PER_DEAL,
	CallbreakConfig,
	CallbreakEvent,
	CallbreakMoveSchemas,
	CallbreakState,
	CallbreakView,
	CardPlayedEvent,
	DealDealtEvent,
	DealScoredEvent,
	PublicDeal,
	ScoreInitializedEvent,
	TrickStartedEvent,
	TrickWonEvent,
	WinsDeclaredEvent
} from "@/games/callbreak/schema";
import {
	activeDealOf,
	activeTrickOf,
	chooseCard,
	dealFor,
	declareFromHand,
	getPlayableCards,
	getTrickWinner,
	isScored,
	scoreDeal,
	trickPlayOrder
} from "@/games/callbreak/utils";
import { CARD_SUITS, getCardSuit } from "@/shared/utils/cards";
import { InvalidMove } from "@/swish/errors";
import { PlayerId, Standing, Standings } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { nextInOrder, playerIdFor } from "@/swish/utils";


// --- Engine ----------------------------------------------------------------

/**
 * Callbreak's runtime, built from its declarative structure.
 *
 * Yielding it builds the command surface the API layer drives the game through —
 * the lifecycle commands, `submitMove`, the history cursor and `getView`.
 *
 * The type arguments are inferred rather than written out, and that only holds
 * while the literal below *is* the call argument: `schemas.moves` and `phases`
 * are homomorphic mapped types, which is what lets TypeScript recover the move
 * names, the phase names and the moves each phase allows from the object
 * literals and feed them back into the contravariant callback positions. Lifted
 * into a `const` of its own, every one of those inference sites is gone and the
 * callbacks fall back to `any`.
 */
export const {
	EngineLive: CallbreakEngineLive,
	Engine: CallbreakEngine,
	Structure: CallbreakStructure
} = makeEngine( {
	name: "callbreak",

	schemas: {
		state: CallbreakState,
		config: CallbreakConfig,
		events: CallbreakEvent,
		view: CallbreakView,
		moves: CallbreakMoveSchemas
	},

	/**
	 * Four seats, the shortest of the offered lengths, and spades for trumps —
	 * the classic table. `autoStart` is on because every seat is interchangeable
	 * here: there is nothing to choose in the lobby once the fourth player sits
	 * down, so waiting for someone to press start only delays the deal.
	 */
	defaultConfig: () => CallbreakConfig.make( {
		playerCount: CALLBREAK_PLAYER_COUNT,
		dealCount: CALLBREAK_DEAL_COUNTS[ 0 ],
		trumpSuit: CARD_SUITS.SPADES,
		autoStart: true,
		botDelayMillis: CALLBREAK_BOT_DELAY_MILLIS
	} ),

	/**
	 * An empty table. Nothing can be dealt here: `setup` runs at creation,
	 * before anyone has taken a seat, and a deal is thirteen cards *to a named
	 * player*. The first deal is cut on entering the declaring phase instead,
	 * which is also where every later one is cut.
	 */
	setup: () => CallbreakState.make( { deals: [], scores: {} } ),

	apply: ( state, event ) => produce( state, draft => {
		switch ( event._tag ) {
			case "callbreak/ev/ScoreInitialized":
				draft.scores[ event.playerId ] = 0;
				return;

			case "callbreak/ev/DealDealt":
				draft.deals.unshift( castDraft( event.deal ) );
				return;

			case "callbreak/ev/WinsDeclared": {
				const deal = draft.deals.at( 0 );
				if ( deal ) {
					deal.declarations[ event.playerId ] = event.wins;
				}

				return;
			}

			case "callbreak/ev/TrickStarted": {
				const deal = draft.deals.at( 0 );
				if ( deal ) {
					deal.tricks.unshift( { leadPlayer: event.leadPlayer, cards: {} } );
				}

				return;
			}

			case "callbreak/ev/CardPlayed": {
				const deal = draft.deals.at( 0 );
				const trick = deal?.tricks.at( 0 );
				if ( !deal || !trick ) {
					return;
				}

				trick.cards[ event.playerId ] = event.cardId;

				// The first card into a trick is what everyone else has to follow, so
				// the led suit is read off it here rather than carried on the event:
				// the card already says what it is.
				if ( !trick.suit ) {
					trick.suit = getCardSuit( event.cardId );
				}

				deal.hands[ event.playerId ] = ( deal.hands[ event.playerId ] ?? [] )
					.filter( card => card !== event.cardId );

				return;
			}

			case "callbreak/ev/TrickWon": {
				const deal = draft.deals.at( 0 );
				const trick = deal?.tricks.at( 0 );
				if ( !deal || !trick ) {
					return;
				}

				trick.winner = event.winner;
				deal.wins[ event.winner ] = ( deal.wins[ event.winner ] ?? 0 ) + 1;
				return;
			}

			case "callbreak/ev/DealScored": {
				const deal = draft.deals.at( 0 );
				if ( !deal ) {
					return;
				}

				deal.scores = { ...event.scores };
				for ( const [ pid, score ] of Object.entries( event.scores ) ) {
					const playerId = PlayerId.make( pid );
					draft.scores[ playerId ] = ( draft.scores[ playerId ] ?? 0 ) + score;
				}
			}
		}
	} ),

	/**
	 * Every deal the table asked for has been played and scored.
	 *
	 * Written plainly because of where the engine asks: the end check lands after
	 * the playing phase has exited — which is where `DealScored` is emitted — but
	 * *before* the next phase is entered, and entering the declaring phase is what
	 * cuts the next deal. So this only ever sees deals that have actually been
	 * played, and never a fresh one dealt on top of the last.
	 */
	endIf: ( { state, config } ) => state.deals.length >= config.dealCount
		&& state.deals.every( isScored ),

	/**
	 * Ranked on the running total, which the state keeps in tenths of a point.
	 * A seat's rank is one more than the number of seats strictly above it, so
	 * two players level on points share a place rather than being separated by
	 * whichever way the sort happened to fall.
	 */
	resolveResults: ( { state, context } ) => {
		const scoreOf = ( playerId: PlayerId ) => state.scores[ playerId ] ?? 0;
		const ranked = [ ...context.players ].sort(
			( left, right ) => scoreOf( right ) - scoreOf( left )
		);

		return Standings.make( {
			ranking: ranked.map( playerId => Standing.make( {
				playerId,
				rank: 1 + ranked.filter( other => scoreOf( other ) > scoreOf( playerId ) ).length,
				score: scoreOf( playerId )
			} ) ),
			winner: ranked.at( 0 )
		} );
	},

	/**
	 * The hands are the only thing a Callbreak table hides, and they are hidden by
	 * being counted rather than dropped: every seat's size goes out in
	 * `handCounts`, including the viewer's own, and `hand` carries the cards of
	 * whichever seat the view was built for. A spectator gets the same shape with
	 * an empty `hand`, so one renderer serves players and onlookers alike.
	 *
	 * Only the deal in play is projected. The finished ones survive in the running
	 * `scores` and in `dealsPlayed`, which is what tells a client how far through
	 * the table is — the one projected deal cannot say that on its own.
	 */
	view: ( { state, context }, audience ) => {
		const playerId = playerIdFor( audience );
		const deal = activeDealOf( state );
		const hands = deal?.hands ?? {};

		return CallbreakView.make( {
			scores: state.scores,
			activeDeal: deal
				? PublicDeal.make( {
					id: deal.id,
					startingPlayer: deal.startingPlayer,
					declarations: deal.declarations,
					wins: deal.wins,
					scores: deal.scores,
					tricks: deal.tricks
				} )
				: undefined,
			dealsPlayed: state.deals.filter( isScored ).length,
			handCounts: Object.fromEntries(
				context.players.map( seat => [ seat, ( hands[ seat ] ?? [] ).length ] )
			),

			// `tricks` is newest-first and the head is the one in progress, so the
			// first trick with a winner on it is the one that just went. A deal with
			// no tricks yet is one still being declared, and the trick that just went
			// is then the previous deal's thirteenth — the deal is cut in the same
			// commit as that trick's last card, so without reaching back for it the
			// card would never be on the table at all.
			lastCompletedTrick: deal?.tricks.length === 0
				? state.deals.at( 1 )?.tricks.at( 0 )
				: deal?.tricks.find( trick => trick.winner !== undefined ),
			playerId,
			hand: playerId ? [ ...( hands[ playerId ] ?? [] ) ] : []
		} );
	},

	hooks: {

		/**
		 * Seeds the running total at zero for every seat. The cards are not dealt
		 * here: `start` enters the initial phase immediately after this runs, and
		 * the declaring phase's `onEnter` is what cuts a deal — for the first one
		 * exactly as for the fifth, so there is only ever one place that deals.
		 */
		onStart: ( { context } ) => context.players.map(
			playerId => ScoreInitializedEvent.make( { playerId } )
		)
	},

	moves: {
		declareWins: {
			validate: ( { state }, playerId, { wins, dealId } ) => {
				const deal = activeDealOf( state );
				if ( !deal || deal.id !== dealId ) {
					return new InvalidMove( {
						move: "declareWins",
						reason: "That deal is not the one in play."
					} );
				}

				// `0` is the sentinel for a seat that has not called yet, which is why
				// the minimum declaration is 1: anything at or above it is a call that
				// has already been made, and a seat calls once per deal.
				if ( ( deal.declarations[ playerId ] ?? 0 ) >= CALLBREAK_MIN_DECLARATION ) {
					return new InvalidMove( {
						move: "declareWins",
						reason: "You have already declared for this deal."
					} );
				}

				if ( wins < CALLBREAK_MIN_DECLARATION || wins > CALLBREAK_TRICKS_PER_DEAL ) {
					return new InvalidMove( {
						move: "declareWins",
						reason: "A declaration must be between "
							+ `${ CALLBREAK_MIN_DECLARATION } and ${ CALLBREAK_TRICKS_PER_DEAL }.`
					} );
				}

				return;
			},

			execute: ( _data, playerId, { wins } ) => [
				WinsDeclaredEvent.make( { playerId, wins } )
			]
		},

		playCard: {

			/**
			 * Callbreak is stricter than most trick-takers — following suit is not
			 * enough, you have to head the trick when you are able to, and trump it
			 * when you are void and holding one. All of that lives in
			 * `getPlayableCards`, which is the same function the policy picks from, so
			 * a bot cannot be offered a card a player would be refused.
			 */
			validate: ( { state, config }, playerId, { cardId, dealId } ) => {
				const deal = activeDealOf( state );
				if ( !deal || deal.id !== dealId ) {
					return new InvalidMove( {
						move: "playCard",
						reason: "That deal is not the one in play."
					} );
				}

				const trick = activeTrickOf( deal );
				if ( !trick ) {
					return new InvalidMove( { move: "playCard", reason: "No trick is in play." } );
				}

				if ( trick.cards[ playerId ] ) {
					return new InvalidMove( {
						move: "playCard",
						reason: "You have already played into this trick."
					} );
				}

				const hand = deal.hands[ playerId ] ?? [];
				if ( !hand.includes( cardId ) ) {
					return new InvalidMove( { move: "playCard", reason: "You do not hold that card." } );
				}

				if ( !getPlayableCards( hand, config.trumpSuit, trick ).includes( cardId ) ) {
					return new InvalidMove( {
						move: "playCard",
						reason: "You must follow suit and head the trick whenever you are able to."
					} );
				}

				return;
			},

			/**
			 * A card, and — when it is the last one into the trick — who took it and
			 * who leads the next.
			 *
			 * `TrickStarted` is emitted here rather than on entering a phase because
			 * only twelve of the thirteen tricks are followed by another one: the
			 * thirteenth ends the deal, and starting a fourteenth trick would leave an
			 * empty one on top of a deal nobody can play into.
			 */
			execute: ( { state, config, context }, playerId, { cardId } ) => {
				const events: CallbreakEvent[] = [ CardPlayedEvent.make( { playerId, cardId } ) ];

				const deal = activeDealOf( state );
				const trick = activeTrickOf( deal );
				if ( !deal || !trick ) {
					return events;
				}

				const cards = { ...trick.cards, [ playerId ]: cardId };
				if ( Object.keys( cards ).length < context.players.length ) {
					return events;
				}

				const winner = getTrickWinner(
					{ ...trick, suit: trick.suit ?? getCardSuit( cardId ), cards },
					config.trumpSuit
				);

				if ( !winner ) {
					return events;
				}

				events.push( TrickWonEvent.make( { winner } ) );

				if ( deal.tricks.length < CALLBREAK_TRICKS_PER_DEAL ) {
					events.push( TrickStartedEvent.make( { leadPlayer: winner } ) );
				}

				return events;
			}
		}
	},

	/**
	 * A seat the game plays calls off the high cards in its hand and then plays
	 * legally and cheaply. It branches on the phase, which it reads off the
	 * context, because the two moves are never both available.
	 *
	 * Everything it reads comes from the redacted view — its own `hand`, the
	 * public deal, the trick in front of it — so it knows exactly what the player
	 * it stands in for would know and nothing more.
	 */
	botMove: ( { state, config, context } ) => {
		const playerId = state.playerId;
		const deal = state.activeDeal;
		if ( !playerId || !deal ) {
			return undefined;
		}

		if ( context.phase === "declaring" ) {
			return {
				moveType: "declareWins",
				input: {
					wins: declareFromHand( state.hand, config.trumpSuit ),
					dealId: deal.id
				}
			};
		}

		const trick = deal.tricks.at( 0 );
		if ( !trick ) {
			return undefined;
		}

		const cardId = chooseCard( playerId, state.hand, config.trumpSuit, trick );
		return cardId ? { moveType: "playCard", input: { cardId, dealId: deal.id } } : undefined;
	},

	initialPhase: "declaring",

	/**
	 * One deal is one lap of a two-phase loop, and the loop is the whole game.
	 *
	 * `declaring` is entered first, and entering it is what *makes* a deal: its
	 * `onEnter` cuts thirteen cards to each seat and announces them, so there is
	 * exactly one place a deal is dealt rather than one for the first and another
	 * for the rest. Each seat then calls once, starting with the deal's own
	 * opener, and the phase ends when the last call is in.
	 *
	 * `playing` is thirteen tricks. Its `onEnter` opens the first one for the
	 * deal's opener; every trick after that is opened by whoever won the last,
	 * from `playCard`'s own `execute`, which is also what keeps the turn cursor
	 * honest — `resolveNextPlayer` just counts the cards already in the trick and
	 * rotates the seating order to its leader. When the thirteenth trick is taken
	 * the phase ends, and `onExit` scores the deal on the way out.
	 *
	 * Then `resolveNextPhase` points back at `declaring` unconditionally. What
	 * stops the loop is the game's own `endIf`, which the engine asks *between*
	 * the exit and the entry: with the last deal scored the game completes and
	 * the phase is never entered, so no fourteenth deal is ever cut.
	 */
	phases: {
		declaring: {
			moves: [ "declareWins" ],

			onEnter: ( { state, context }, rng ) => [
				DealDealtEvent.make( {
					deal: dealFor( context.players, state.deals.length, rng )
				} )
			],

			// Read off the deal `onEnter` has just announced, rather than recomputed:
			// the engine seats the starting player after the entry events are folded.
			resolveStartingPlayer: ( { state, context } ) =>
				activeDealOf( state )?.startingPlayer ?? context.players[ 0 ]!,

			endIf: ( { state, context } ) => {
				const deal = activeDealOf( state );
				return !!deal && context.players.every(
					playerId => ( deal.declarations[ playerId ] ?? 0 ) >= CALLBREAK_MIN_DECLARATION
				);
			},

			resolveNextPlayer: ( { context }, playerId ) => nextInOrder( context, playerId ),

			resolveNextPhase: () => "playing"
		},

		playing: {
			moves: [ "playCard" ],

			onEnter: ( { state, context } ) => [
				TrickStartedEvent.make( {
					leadPlayer: activeDealOf( state )?.startingPlayer ?? context.players[ 0 ]!
				} )
			],

			resolveStartingPlayer: ( { state, context } ) =>
				activeTrickOf( activeDealOf( state ) )?.leadPlayer ?? context.players[ 0 ]!,

			endIf: ( { state } ) => {
				const deal = activeDealOf( state );
				return !!deal
					&& deal.tricks.length >= CALLBREAK_TRICKS_PER_DEAL
					&& activeTrickOf( deal )?.winner !== undefined;
			},

			/**
			 * The seat that plays next is wherever the trick has got to: the play
			 * order is the seating order rotated to the trick's leader, and the number
			 * of cards already in it is the offset into that. It answers the fresh
			 * trick as well as the one in progress — a trick opened by the winner of
			 * the last holds no cards, so the offset is zero and the leader is named.
			 */
			resolveNextPlayer: ( { state, context } ) => {
				const trick = activeTrickOf( activeDealOf( state ) );
				if ( !trick ) {
					return context.currentPlayer ?? context.players[ 0 ]!;
				}

				const order = trickPlayOrder( trick, context.players );
				return order[ Object.keys( trick.cards ).length % order.length ]!;
			},

			/**
			 * Scoring the deal on the way out is what makes the game's `endIf`
			 * readable: the end check runs after this and before the next deal is
			 * cut, so "every deal has been scored" is a question about deals that have
			 * actually been played.
			 */
			onExit: ( { state, context } ) => {
				const deal = activeDealOf( state );
				if ( !deal ) {
					return [];
				}

				return [
					DealScoredEvent.make( {
						scores: scoreDeal( context.players, deal.declarations, deal.wins )
					} )
				];
			},

			resolveNextPhase: () => "declaring"
		}
	}
} );
