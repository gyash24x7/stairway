import * as Schema from "effect/Schema";

import { produce } from "immer";

import { BaseGameConfig, InteractionOpened, PlayerId } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { answersOf } from "@/swish/utils";


/**
 * A game made of nothing but interaction windows, to reach the parts of the
 * stack coup leaves alone.
 *
 * Coup is the only game with `interactions`, and it opens every window the same
 * way: from a move's `execute` or another window's `onResolve`, always with an
 * explicit option list, always with a timeout, never secret. So five things have
 * never run — a window opened with no options at all (which should offer the
 * kind's own move list to everybody), a window with no timeout, a secret `all`
 * window, a window opened from a lifecycle hook, and a window with no responders
 * that has to settle the instant it appears.
 *
 * The three kinds:
 * - `vote` is secret and `all`, and is opened with no options
 * - `open` is a plain first-answer window with no timeout
 * - `chain` opens another `chain` from its own resolution, for the cascade guard
 */

export const AskingConfig = Schema.Struct( {
	...BaseGameConfig.fields,

	/** Opens a window from `onStart` when set. */
	askAtStart: Schema.Boolean,

	/** Opens a window from `onJoin` when set. */
	askOnJoin: Schema.Boolean,

	/** Opens a window from `afterMove` when set. */
	askAfterMove: Schema.Boolean,

	/** How far `chain` is allowed to nest before it stops. */
	chainDepth: Schema.Int
} );

export type AskingState = typeof AskingState.Type;
export const AskingState = Schema.Struct( {
	/** Everything that has been folded, in order. */
	log: Schema.Array( Schema.String ),

	/** How many windows have settled. */
	settled: Schema.Int,

	/** Set once `stop` has been played, which ends the game. */
	over: Schema.Boolean
} );

export const Logged = Schema.TaggedStruct( "asking/ev/Logged", { note: Schema.String } );

export const Settled = Schema.TaggedStruct( "asking/ev/Settled", { kind: Schema.String } );

export const Over = Schema.TaggedStruct( "asking/ev/Over", {} );

export const AskingEvent = Schema.Union( [ Logged, Settled, Over ] );

export const AskingView = Schema.Struct( {
	...AskingState.fields,
	playerId: Schema.optional( PlayerId )
} );

const NoInput = Schema.Struct( {} );
const VoteInput = Schema.Struct( { choice: Schema.String } );


export const {
	Engine: AskingEngine,
	EngineLive: AskingEngineLive,
	Structure: AskingStructure
} = makeEngine( {
	name: "askingtest",

	schemas: {
		state: AskingState,
		config: AskingConfig,
		events: AskingEvent,
		view: AskingView,
		moves: {
			ask: NoInput,
			askAll: NoInput,
			askNobody: NoInput,
			startChain: NoInput,
			stop: NoInput,
			yes: NoInput,
			no: NoInput,
			vote: VoteInput,
			link: NoInput
		}
	},

	defaultConfig: () => AskingConfig.make( {
		playerCount: 3,
		autoStart: true,
		askAtStart: false,
		askOnJoin: false,
		askAfterMove: false,
		chainDepth: 3,
		botDelayMillis: 3_600_000,
		moveTimeoutMillis: 3_600_000
	} ),

	setup: () => AskingState.make( { log: [], settled: 0, over: false } ),

	apply: ( state, event ) => produce( state, draft => {
		switch ( event._tag ) {
			case "asking/ev/Logged":
				draft.log.push( event.note );
				return;

			case "asking/ev/Settled":
				draft.settled++;
				draft.log.push( `settled:${ event.kind }` );
				return;

			case "asking/ev/Over":
				draft.over = true;
		}
	} ),

	endIf: ( { state } ) => state.over,

	resolveResults: ( { context } ) => ( {
		_tag: "swish/Standings" as const,
		ranking: context.players.map( playerId => ( {
			_tag: "swish/PlayerStanding" as const,
			playerId,
			rank: 1
		} ) )
	} ),

	view: ( { state }, audience ) => AskingView.make( {
		...state,
		playerId: audience._tag === "swish/PlayerAudience" ? audience.playerId : undefined
	} ),

	hooks: {
		/**
		 * A window opened before anybody has taken a turn. The engine's comments say
		 * a game that opens with a decision is supported; nothing has ever done it.
		 */
		onStart: ( { config, context } ) => config.askAtStart
			? [
				InteractionOpened.make( {
					kind: "open",
					initiator: context.players[ 0 ]!,
					responders: context.players.slice( 1 )
				} )
			]
			: [],

		/**
		 * A window opened from a join, which lands before the table is even full.
		 */
		onJoin: ( { config, context }, playerId ) => config.askOnJoin && context.players.length > 0
			? [
				InteractionOpened.make( {
					kind: "open",
					initiator: playerId,
					responders: context.players.filter( seat => seat !== playerId )
				} )
			]
			: [],

		afterMove: ( { config, context }, playerId, moveType ) =>
			config.askAfterMove && moveType === "ask"
				? [
					InteractionOpened.make( {
						kind: "open",
						initiator: playerId,
						responders: context.players.filter( seat => seat !== playerId )
					} )
				]
				: []
	},

	moves: {
		/** Opens a plain window, spelling its options out. */
		ask: {
			validate: () => undefined,
			execute: ( { context }, playerId ) => [
				Logged.make( { note: `ask:${ playerId }` } ),
				InteractionOpened.make( {
					kind: "open",
					initiator: playerId,
					responders: context.players.filter( seat => seat !== playerId ),
					options: [ { _tag: "swish/InteractionOption", move: "yes" } ]
				} )
			]
		},

		/**
		 * Opens a window naming only its kind. Everything else — the options, the
		 * resolution, whether it may be declined — is filled in from the kind's
		 * declaration on the way into the commit.
		 */
		askAll: {
			validate: () => undefined,
			execute: ( { context }, playerId ) => [
				InteractionOpened.make( {
					kind: "vote",
					initiator: playerId,
					responders: context.players.filter( seat => seat !== playerId )
				} )
			]
		},

		/** Opens a window nobody is being asked, which has to settle immediately. */
		askNobody: {
			validate: () => undefined,
			execute: ( _data, playerId ) => [
				InteractionOpened.make( { kind: "open", initiator: playerId, responders: [] } )
			]
		},

		/** Opens a window whose resolution opens another, and another. */
		startChain: {
			validate: () => undefined,
			execute: ( _data, playerId ) => [
				InteractionOpened.make( { kind: "chain", initiator: playerId, responders: [] } )
			]
		},

		stop: {
			validate: () => undefined,
			execute: () => [ Over.make( {} ) ]
		},

		// --- Responses ------------------------------------------------------

		yes: { validate: () => undefined, execute: () => [] },
		no: { validate: () => undefined, execute: () => [] },
		vote: { validate: () => undefined, execute: () => [] },
		link: { validate: () => undefined, execute: () => [] }
	},

	interactions: {
		/**
		 * A plain race, and the only window here that is ever declined. No
		 * `timeoutMillis` at all: it stays open until somebody answers, which is
		 * only safe because every responder is certain to.
		 */
		open: {
			moves: [ "yes", "no" ],
			resolution: "first",
			allowPass: true,
			onResolve: ( _data, frame ) => [
				Settled.make( { kind: "open" } ),
				...answersOf( frame ).map( answer => Logged.make( {
					note: `open:${ answer.playerId }:${ answer.move }`
				} ) )
			]
		},

		/**
		 * Everybody answers, and nobody sees anybody else's answer until they all
		 * have. The pair of flags that makes a window simultaneous, which no shipped
		 * game sets.
		 */
		vote: {
			moves: [ "vote", "no" ],
			resolution: "all",
			allowPass: true,
			secret: true,
			onResolve: ( _data, frame ) => [
				Settled.make( { kind: "vote" } ),
				...answersOf( frame ).map( answer => Logged.make( {
					note: `vote:${ answer.playerId }:${ answer.move }`
				} ) )
			]
		},

		/**
		 * Opens another of itself every time it settles. Bounded by `chainDepth`
		 * normally; a test raises it past the engine's own ceiling to prove the
		 * guard fires rather than folding events until it runs out of memory.
		 */
		chain: {
			moves: [ "link" ],
			resolution: "first",
			allowPass: true,
			onResolve: ( { state, config }, frame ) => state.settled >= config.chainDepth
				? [ Settled.make( { kind: "chain" } ) ]
				: [
					Settled.make( { kind: "chain" } ),
					InteractionOpened.make( {
						kind: "chain",
						initiator: frame.initiator,
						responders: []
					} )
				]
		}
	},

	/**
	 * Answers whatever the window's first option is, so a window can be driven to
	 * settlement by the clock rather than by hand.
	 */
	botRespond: ( _data, frame ) => {
		const option = frame.options[ 0 ];
		if ( !option ) {
			return undefined;
		}

		return option.move === "vote"
			? { moveType: "vote" as const, input: { choice: "aye" } }
			: { moveType: option.move as "yes", input: {} };
	}
} );
