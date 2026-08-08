import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as References from "effect/References";
import * as Schema from "effect/Schema";

import { InvalidMove } from "@/shared/swish/errors.ts";
import { openInteraction } from "@/shared/swish/events.ts";
import { InteractionFrame, PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";
import { EventStore, GameArchive, GameStore, Scheduler, Sync } from "@/shared/swish/services.ts";
import type { AlarmKind } from "@/shared/swish/services.ts";
import type { GameStructure } from "@/shared/swish/structure.ts";


// --- In-memory host --------------------------------------------------------

/**
 * Everything an engine needs from its host. `RuntimeContext` rides along because
 * every service method declares it (the Cloudflare bindings need it at request
 * time); the in-memory fakes never read it, so `phantom` satisfies it.
 */
export type EngineDeps =
	| GameStore
	| EventStore
	| Scheduler
	| Sync
	| GameArchive
	| Alchemy.RuntimeContext;

export interface Memory {
	readonly layer: Layer.Layer<EngineDeps>;
	readonly store: { value: unknown };
	readonly log: { base: unknown; commits: Array<unknown>; cursor: number };
	readonly scheduler: { scheduled: Array<{ key: string; alarm: AlarmKind }> };
	readonly broadcasts: Array<{ channel: string; snapshot: unknown }>;
	readonly archive: Map<string, unknown>;
}

export function makeMemory() {
	const store = { value: null as unknown };
	const log = { base: null as unknown, commits: [] as Array<unknown>, cursor: -1 };
	const scheduler = { scheduled: [] as Array<{ key: string; alarm: AlarmKind }> };
	const broadcasts: Array<{ channel: string; snapshot: unknown }> = [];
	const archive = new Map<string, unknown>();

	const gameStore = GameStore.of( {
		load: <T>() => Effect.sync( () => Option.fromNullOr( store.value as T ) ),
		save: ( encoded ) => Effect.sync( () => { store.value = encoded; } ),
		clear: () => Effect.sync( () => { store.value = null; } )
	} );

	const eventStore = EventStore.of( {
		setBase: ( encoded ) => Effect.sync( () => {
			log.base = encoded;
			log.commits = [];
			log.cursor = -1;
		} ),

		append: ( commit ) => Effect.sync( () => {
			log.commits = log.commits.slice( 0, log.cursor + 1 );
			log.commits.push( commit );
			log.cursor = log.commits.length - 1;
		} ),

		moveCursor: ( delta ) => Effect.sync( () => {
			if ( delta === -1 ) {
				if ( log.cursor < 0 ) {
					return Option.none();
				}

				log.cursor -= 1;
				return Option.some( log.cursor );
			}

			if ( log.cursor >= log.commits.length - 1 ) {
				return Option.none();
			}

			log.cursor += 1;
			return Option.some( log.cursor );
		} ),

		read: () => Effect.sync( () => log )
	} );

	const schedulerSvc = Scheduler.of( {
		schedule: ( key, _delayMillis, alarm ) =>
			Effect.sync( () => { scheduler.scheduled.push( { key, alarm } ); } ),

		cancel: ( key: string ) => Effect.sync( () => {
			scheduler.scheduled = scheduler.scheduled.filter( ( s ) => s.key !== key );
		} ),

		cancelAll: () => Effect.sync( () => { scheduler.scheduled = []; } ),

		due: () => Effect.sync( () => {
			const alarms = scheduler.scheduled.map( ( s ) => s.alarm );
			scheduler.scheduled = [];
			return alarms;
		} )
	} );

	const sync = Sync.of( {
		broadcast: ( channel, snapshot ) => Effect.sync( () => {
			broadcasts.push( { channel, snapshot } );
		} )
	} );

	const gameArchive = GameArchive.of( {
		save: ( key, encoded ) => Effect.sync( () => { archive.set( key, encoded ); } ),
		load: ( key ) => Effect.sync( () => Option.fromNullishOr( archive.get( key ) ) ),
		remove: ( key ) => Effect.sync( () => { archive.delete( key ); } )
	} );

	const layer = Layer.mergeAll(
		Layer.succeed( GameStore, gameStore ),
		Layer.succeed( EventStore, eventStore ),
		Layer.succeed( Scheduler, schedulerSvc ),
		Layer.succeed( Sync, sync ),
		Layer.succeed( GameArchive, gameArchive ),
		Alchemy.RuntimeContext.phantom
	);

	return { layer, store, log, scheduler, broadcasts, archive };
}

/** Run an engine effect against a memory host, surfacing failures as rejections. */
export function run<A, E>( memory: Memory, effect: Effect.Effect<A, E, EngineDeps> ) {
	return Effect.runPromise( effect.pipe( Effect.provide( memory.layer ) ) );
}

/** Run an engine effect expecting it to fail, resolving with the typed error. */
export function runFail<A, E>( memory: Memory, effect: Effect.Effect<A, E, EngineDeps> ) {
	return run( memory, Effect.flip( effect ) );
}

/**
 * Like {@link run}, with logging off. Use it for the paths where the engine
 * deliberately swallows and logs a failure (the alarm entry point): the log is
 * the behaviour under test, not output the suite should print.
 */
export function runSilent<A, E>( memory: Memory, effect: Effect.Effect<A, E, EngineDeps> ) {
	return run( memory, Effect.provideService( effect, References.MinimumLogLevel, "None" ) );
}

// --- Player fixtures -------------------------------------------------------

export const player = ( id: string, isBot = false ) => PlayerInfo.make( {
	id: id as PlayerId,
	name: id.toUpperCase(),
	avatar: `${ id }.png`,
	isBot
} );

// ===========================================================================
// tallyGame — a flat game. Players take turns adding to their score; first to
// `target` ends the game. Exercises setup/apply/view/endIf, per-move validate,
// enabledWhen gating, endsTurn:false, resolveNextPlayer, describe, botMove,
// resolveResults.
// ===========================================================================

const TallyState = Schema.Struct( { scores: Schema.Record( PlayerId, Schema.Number ) } );
const TallyConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.Boolean,
	target: Schema.Number,
	allowBig: Schema.Boolean,
	// Drives `botMove`: play normally, pass (`undefined`), or return a move the
	// engine will reject — the three outcomes the alarm path has to survive.
	bot: Schema.Literals( [ "normal", "idle", "broken" ] )
} );

const TallyView = Schema.Struct( {
	scores: Schema.Record( PlayerId, Schema.Number ),
	me: Schema.optional( Schema.Number )
} );

const Scored = Schema.TaggedStruct( "tally/Scored", {
	playerId: PlayerId,
	amount: Schema.Number
} );

const AmountInput = Schema.Struct( { amount: Schema.Number } );

const scoreOf = ( scores: Record<PlayerId, number>, id: PlayerId ) => scores[ id ] ?? 0;

export const tallyGame: GameStructure<
	"tally",
	typeof TallyState.Type,
	typeof TallyConfig.Type,
	{ add: typeof AmountInput; big: typeof AmountInput; combo: typeof AmountInput },
	{ add: [ "add" ]; big: [ "big" ]; combo: [ "combo" ] },
	typeof Scored.Type,
	typeof TallyView.Type
> = {
	name: "tally",
	schemas: {
		state: TallyState,
		config: TallyConfig,
		events: Scored,
		view: TallyView,
		moves: { add: AmountInput, big: AmountInput, combo: AmountInput }
	},
	setup: () => ( { scores: {} } ),
	apply: ( state, event ) => ( {
		scores: {
			...state.scores,
			[ event.playerId ]: scoreOf( state.scores, event.playerId ) + event.amount
		}
	} ),
	endIf: ( data ) => Object.values( data.state.scores ).some( ( s ) => s >= data.config.target ),
	resolveResults: ( data ) => {
		const ranked = Object.entries( data.state.scores )
			.map( v => v as [ PlayerId, number ] )
			.sort( ( [ , a ], [ , b ] ) => b - a );

		return {
			winner: ranked[ 0 ]?.[ 0 ],
			ranking: ranked.map( ( [ playerId, score ], i ) => ( { playerId, rank: i + 1, score } ) )
		};
	},

	describe: ( event, players ) => `${ players[ event.playerId ]?.name ?? "?" } +${ event.amount }`,
	view: ( data, audience ) => audience._tag === "swish/Player"
		? { scores: data.state.scores, me: scoreOf( data.state.scores, audience.id ) }
		: { scores: data.state.scores },
	hooks: {},
	moves: {
		add: {
			validate: ( _data, _pid, input ) => input.amount <= 0
				? new InvalidMove( { move: "add", reason: "amount must be positive" } )
				: undefined,
			execute: ( _data, pid, input ) => [ Scored.make( { playerId: pid, amount: input.amount } ) ]
		},
		big: {
			enabledWhen: ( config ) => config.allowBig,
			validate: () => undefined,
			execute: ( _data, pid, input ) => [
				Scored.make( { playerId: pid, amount: input.amount * 10 } )
			]
		},
		combo: {
			// A move that does NOT end the turn: the actor keeps control.
			endsTurn: false,
			validate: () => undefined,
			execute: ( _data, pid, input ) => [ Scored.make( { playerId: pid, amount: input.amount } ) ]
		}
	},
	resolveNextPlayer: ( data, playerId ) => {
		const ids = data.context.players;
		const i = ids.indexOf( playerId );
		return ids[ ( i + 1 ) % ids.length ]!;
	},
	botMove: ( snapshot ) => {
		switch ( snapshot.config.bot ) {
			// Nothing to do this turn — the engine must simply not move.
			case "idle":
				return undefined;
			// `add` rejects a non-positive amount, so this fails inside the alarm.
			case "broken":
				return { moveType: "add" as const, input: { amount: 0 } };
			default:
				return { moveType: "add" as const, input: { amount: 1 } };
		}
	}
};

// ===========================================================================
// duelGame — three players, two interaction windows. On `attack` the engine
// opens a SIMULTANEOUS "defense" window routed to the other two players; each
// answers with `defend`; when both have, `resolve` applies damage to
// non-blockers and the turn resumes. On `challenge` it opens a SEQUENTIAL
// "duelist" window (custom `isComplete`, validated responses) — sequential
// frames are public, so they also pin down what redaction leaves alone.
// `ghostOnResolve` makes `defense.resolve` open a window of an unknown kind,
// which must halt the resolve loop rather than spin.
// ===========================================================================

const DuelState = Schema.Struct( { hp: Schema.Record( PlayerId, Schema.Number ) } );
const DuelConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.Boolean,
	ghostOnResolve: Schema.Boolean
} );

const DuelView = Schema.Struct( { hp: Schema.Record( PlayerId, Schema.Number ) } );
const Attacked = Schema.TaggedStruct( "duel/Attacked", { by: PlayerId } );
const Damaged = Schema.TaggedStruct( "duel/Damaged", {
	playerId: PlayerId,
	amount: Schema.Number
} );

const DuelEvents = Schema.Union( [ Attacked, Damaged ] );
const EmptyInput = Schema.Struct( {} );
const DefendInput = Schema.Struct( { block: Schema.Boolean } );
const AnswerInput = Schema.Struct( { value: Schema.Number } );

const START_HP = 10;
const ATTACK_DAMAGE = 3;
const DUEL_DAMAGE = 1;

export const duelGame: GameStructure<
	"duel",
	typeof DuelState.Type,
	typeof DuelConfig.Type,
	{
		attack: typeof EmptyInput;
		defend: typeof DefendInput;
		challenge: typeof EmptyInput;
		answer: typeof AnswerInput;
	},
	{ attack: [ "attack" ]; defend: [ "defend" ] },
	typeof DuelEvents.Type,
	typeof DuelView.Type
> = {
	name: "duel",
	schemas: {
		state: DuelState,
		config: DuelConfig,
		events: DuelEvents,
		view: DuelView,
		moves: {
			attack: EmptyInput,
			defend: DefendInput,
			challenge: EmptyInput,
			answer: AnswerInput
		}
	},
	setup: () => ( { hp: {} } ),
	apply: ( state, event ) => event._tag === "duel/Damaged"
		? {
			hp: {
				...state.hp,
				[ event.playerId ]: ( state.hp[ event.playerId ] ?? START_HP ) - event.amount
			}
		}
		: state,
	endIf: () => false,
	view: ( data ) => ( { hp: data.state.hp } ),
	hooks: {},
	moves: {
		attack: {
			validate: () => undefined,
			execute: ( data, pid ) => {
				const responders = data.context.players.filter( ( id ) => id !== pid );
				const frame = InteractionFrame.make( {
					kind: "defense",
					initiator: pid,
					responders,
					mode: "simultaneous",
					responses: {}
				} );
				return [ Attacked.make( { by: pid } ), openInteraction( frame ) ];
			}
		},
		defend: {
			validate: () => undefined,
			execute: () => []
		},
		challenge: {
			validate: () => undefined,
			execute: ( data, pid ) => {
				const responders = data.context.players.filter( ( id ) => id !== pid );
				const frame = InteractionFrame.make( {
					kind: "duelist",
					initiator: pid,
					responders,
					mode: "sequential",
					responses: {}
				} );
				return [ openInteraction( frame ) ];
			}
		},
		answer: {
			validate: ( _data, _pid, input ) => input.value < 0
				? new InvalidMove( { move: "answer", reason: "value must not be negative" } )
				: undefined,
			execute: () => []
		}
	},
	interactions: {
		defense: {
			responseMoves: [ "defend" ],
			resolve: ( data, frame ) => {
				const damage = frame.responders.flatMap( ( rid ) => {
					const answer = frame.responses[ rid ] as { block: boolean } | undefined;
					return answer?.block ? [] : [ Damaged.make( { playerId: rid, amount: ATTACK_DAMAGE } ) ];
				} );

				if ( !data.config.ghostOnResolve ) {
					return damage;
				}

				// A nested window of a kind the game never declared: the engine has to
				// stop draining the stack instead of looping on a frame it can't resolve.
				const ghost = InteractionFrame.make( {
					kind: "ghost",
					initiator: frame.initiator,
					responders: [],
					mode: "simultaneous",
					responses: {}
				} );

				return [ ...damage, openInteraction( ghost ) ];
			}
		},
		duelist: {
			responseMoves: [ "answer" ],
			// Custom completion: one answer is enough, the rest never get to speak.
			isComplete: ( _data, frame ) => Object.keys( frame.responses ).length >= 1,
			resolve: ( _data, frame ) => Object.entries( frame.responses )
				.filter( ( [ , answer ] ) => ( answer as { value: number } ).value > 0 )
				.map( ( [ rid ] ) => Damaged.make( {
					playerId: PlayerId.make( rid ),
					amount: DUEL_DAMAGE
				} ) )
		}
	},
	resolveNextPlayer: ( data, playerId ) => {
		const ids = data.context.players;
		const i = ids.indexOf( playerId );
		return ids[ ( i + 1 ) % ids.length ]!;
	}
};

// ===========================================================================
// phasedGame — a two-phase game: draw → play. One `drawCard` in the draw phase
// transitions to play; one `playCard` in the play phase ends the game.
// Exercises initialPhase entry, per-phase move gating, phase transition, and
// game completion out of a phase.
// ===========================================================================

const PhasedState = Schema.Struct( { drawn: Schema.Boolean, played: Schema.Boolean } );
const PhasedConfig = Schema.Struct( { playerCount: Schema.Number, autoStart: Schema.Boolean } );
const PhasedView = Schema.Struct( { drawn: Schema.Boolean, played: Schema.Boolean } );
const Drew = Schema.TaggedStruct( "phased/Drew", {} );
const Played = Schema.TaggedStruct( "phased/Played", {} );
const PhasedEvents = Schema.Union( [ Drew, Played ] );

export const phasedGame: GameStructure<
	"phased",
	typeof PhasedState.Type,
	typeof PhasedConfig.Type,
	{ drawCard: typeof EmptyInput; playCard: typeof EmptyInput },
	{ draw: [ "drawCard" ]; play: [ "playCard" ] },
	typeof PhasedEvents.Type,
	typeof PhasedView.Type
> = {
	name: "phased",
	schemas: {
		state: PhasedState,
		config: PhasedConfig,
		events: PhasedEvents,
		view: PhasedView,
		moves: { drawCard: EmptyInput, playCard: EmptyInput }
	},
	setup: () => ( { drawn: false, played: false } ),
	apply: ( state, event ) => event._tag === "phased/Drew"
		? { ...state, drawn: true }
		: { ...state, played: true },
	endIf: ( data ) => data.state.played,
	view: ( data ) => ( { drawn: data.state.drawn, played: data.state.played } ),
	hooks: {},
	moves: {
		drawCard: {
			phase: "draw",
			validate: () => undefined,
			execute: () => [ Drew.make( {} ) ]
		},
		playCard: {
			phase: "play",
			validate: () => undefined,
			execute: () => [ Played.make( {} ) ]
		}
	},
	initialPhase: "draw",
	phases: {
		draw: {
			moves: [ "drawCard" ],
			endIf: ( data ) => data.state.drawn,
			resolveStartingPlayer: ( data ) => data.context.players[ 0 ]!,
			resolveNextPhase: () => "play"
		},
		play: {
			moves: [ "playCard" ],
			endIf: ( data ) => data.state.played,
			resolveNextPhase: () => "play"
		}
	}
};

// ===========================================================================
// hookedGame — a two-phase game whose only purpose is to record the order the
// engine calls things in. Every hook (`onJoin`/`onStart`/`beforeMove`/
// `afterMove`/`onEnd`) and every phase callback (`onEnter`/`onExit`/
// `resolveStartingPlayer`/`resolveNextPlayer`/`resolveNextPhase`) appends a
// label to `state.trace`, so one assertion pins the whole lifecycle order.
// `badPhase` makes `warmup` transition to a phase that doesn't exist.
// ===========================================================================

const HookedState = Schema.Struct( {
	trace: Schema.Array( Schema.String ),
	steps: Schema.Number,
	done: Schema.Boolean
} );

const HookedConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.Boolean,
	badPhase: Schema.Boolean
} );

const HookedView = Schema.Struct( {
	trace: Schema.Array( Schema.String ),
	steps: Schema.Number,
	done: Schema.Boolean
} );

const Logged = Schema.TaggedStruct( "hooked/Logged", { label: Schema.String } );
const Stepped = Schema.TaggedStruct( "hooked/Stepped", {} );
const Finished = Schema.TaggedStruct( "hooked/Finished", {} );
const HookedEvents = Schema.Union( [ Logged, Stepped, Finished ] );

const STEPS_PER_WARMUP = 2;

/** Appends one label to the trace; the fixture's single state mutation. */
const trace = ( label: string ) => [ Logged.make( { label } ) ];

export const hookedGame: GameStructure<
	"hooked",
	typeof HookedState.Type,
	typeof HookedConfig.Type,
	{ step: typeof EmptyInput; finish: typeof EmptyInput },
	{ warmup: [ "step" ]; main: [ "finish" ] },
	typeof HookedEvents.Type,
	typeof HookedView.Type
> = {
	name: "hooked",
	schemas: {
		state: HookedState,
		config: HookedConfig,
		events: HookedEvents,
		view: HookedView,
		moves: { step: EmptyInput, finish: EmptyInput }
	},
	setup: () => ( { trace: [], steps: 0, done: false } ),
	apply: ( state, event ) => {
		switch ( event._tag ) {
			case "hooked/Logged":
				return { ...state, trace: [ ...state.trace, event.label ] };
			case "hooked/Stepped":
				return { ...state, steps: state.steps + 1, trace: [ ...state.trace, "step" ] };
			case "hooked/Finished":
				return { ...state, done: true, trace: [ ...state.trace, "finish" ] };
		}
	},
	endIf: ( data ) => data.state.done,
	view: ( data ) => data.state,
	hooks: {
		onJoin: ( _data, playerId ) => trace( `onJoin:${ playerId }` ),
		onStart: () => trace( "onStart" ),
		beforeMove: ( _data, _playerId, moveType ) => trace( `before:${ moveType }` ),
		afterMove: ( _data, _playerId, moveType ) => trace( `after:${ moveType }` ),
		onEnd: () => trace( "onEnd" )
	},
	moves: {
		step: {
			phase: "warmup",
			validate: () => undefined,
			execute: () => [ Stepped.make( {} ) ]
		},
		finish: {
			phase: "main",
			validate: () => undefined,
			execute: () => [ Finished.make( {} ) ]
		}
	},
	initialPhase: "warmup",
	phases: {
		warmup: {
			moves: [ "step" ],
			endIf: ( data ) => data.state.steps >= STEPS_PER_WARMUP,
			resolveStartingPlayer: ( data ) => data.context.players[ 0 ]!,
			onEnter: () => trace( "enter:warmup" ),
			onExit: () => trace( "exit:warmup" ),
			// The cast is the point: a resolver may name a phase that isn't declared,
			// and `enterPhase` has to reject it rather than enter a broken state.
			resolveNextPhase: ( data ) => data.config.badPhase ? ( "nope" as "main" ) : "main",
			resolveNextPlayer: ( data, playerId ) => {
				const ids = data.context.players;
				const i = ids.indexOf( playerId );
				return ids[ ( i + 1 ) % ids.length ]!;
			}
		},
		main: {
			moves: [ "finish" ],
			// Never ends on its own — game completion is driven by `endIf` instead.
			endIf: () => false,
			onEnter: () => trace( "enter:main" ),
			resolveNextPhase: () => "main"
		}
	}
};
