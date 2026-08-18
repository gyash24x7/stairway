import * as Schema from "effect/Schema";

import { makeEngine } from "@/swish/server/engine.ts";
import type { GameData, InteractionFrame as Frame } from "@/swish/shared/schema.ts";
import {
	BaseGameConfig,
	InteractionFrame,
	InteractionOpened,
	InvalidMove,
	PlayerId
} from "@/swish/shared/schema.ts";
import { playerIdFor } from "@/swish/server/utils.ts";
import type { GameStructure } from "@/swish/server/structure.ts";

/**
 * A four-seat game whose whole purpose is reaction windows. One move opens a
 * frame of the requested kind, one move answers whatever frame is open, and one
 * move does neither — which is what makes it the move a frame must refuse.
 *
 * The three kinds cover the three ways a frame differs:
 * - `duel` — sequential, every default in place.
 * - `vote` — simultaneous, with its own `isComplete`, `timeoutMillis` and
 * 		`onTimeout`, so it settles on a partial answer and expires on its own clock.
 * - `audit` — sequential, with a `canRespond` that hands the frame to the one
 * 		player it names rather than to the next responder in order.
 *
 * Everything that happens is appended to `log`, so a test reads the sequence
 * back rather than inferring it.
 */

export type ParleyState = typeof ParleyState.Type;
export const ParleyState = Schema.Struct( {
	log: Schema.Array( Schema.String )
} );

export type ParleyConfig = typeof ParleyConfig.Type;
export const ParleyConfig = Schema.Struct( {
	...BaseGameConfig.fields,

	/** How many frames must resolve before the game is over. */
	target: Schema.Number,

	/** When true the bot policy passes rather than answering, so nothing plays. */
	passive: Schema.optional( Schema.Boolean )
} );

export type ParleyView = typeof ParleyView.Type;
export const ParleyView = Schema.Struct( {
	log: Schema.Array( Schema.String ),
	playerId: Schema.optional( PlayerId )
} );

export const Logged = Schema.TaggedStruct( "parley/ev/Logged", { note: Schema.String } );

export type ParleyEvent = typeof ParleyEvent.Type;
export const ParleyEvent = Schema.Union( [ Logged ] );

/**
 * The kinds a table may open. `ghost` is deliberately not declared under
 * `interactions`, which is what makes it the frame the engine cannot resolve.
 */
export type FrameKind = typeof FrameKind.Type;
export const FrameKind = Schema.Literals( [ "duel", "vote", "audit", "ghost" ] );

export type OpenInput = typeof OpenInput.Type;
export const OpenInput = Schema.Struct( {
	kind: FrameKind,

	/** A deadline the game sets itself, which the engine must leave alone. */
	deadline: Schema.optional( Schema.Number ),

	/** Marks a `duel` that opens a `vote` as it resolves. */
	nest: Schema.optional( Schema.Boolean ),

	/** Buries a `ghost` frame under the one being opened, in the same move. */
	beneath: Schema.optional( Schema.Boolean )
} );

export type ReplyInput = typeof ReplyInput.Type;
export const ReplyInput = Schema.Struct( {
	value: Schema.Boolean,

	/** `bad` is refused by `validate`, which a response move runs like any other. */
	token: Schema.optional( Schema.String )
} );

export type PassInput = typeof PassInput.Type;
export const PassInput = Schema.Struct( {} );

type ParleyMoves = {
	open: typeof OpenInput;
	reply: typeof ReplyInput;
	pass: typeof PassInput;
};

const note = ( text: string ) => Logged.make( { note: text } );

/** Everyone but the player opening the frame, in seat order. */
const respondersFor = ( data: GameData<ParleyState, ParleyConfig>, playerId: PlayerId ) =>
	data.context.players.filter( other => other !== playerId );

/**
 * Builds the frame a kind opens. `audit` names its second responder as the
 * target, which is the only player its `canRespond` lets answer.
 */
const frameFor = (
	data: GameData<ParleyState, ParleyConfig>,
	playerId: PlayerId,
	input: OpenInput
) => {
	const responders = respondersFor( data, playerId );

	return InteractionFrame.make( {
		kind: input.kind,
		initiator: playerId,
		responders,
		mode: input.kind === "vote" ? "simultaneous" : "sequential",
		responses: {},
		...( input.kind === "audit" ? { target: responders[ 1 ] ?? responders[ 0 ] } : {} ),
		...( input.nest ? { payload: "nest" } : {} ),
		...( input.deadline === undefined ? {} : { deadline: input.deadline } )
	} );
};

/** How many responders said yes. */
const acceptedIn = ( frame: Frame ) =>
	Object.values( frame.responses )
		.filter( response => ( response as ReplyInput | undefined )?.value === true )
		.length;

export const parleyStructure: GameStructure<
	"parley",
	ParleyState,
	ParleyConfig,
	ParleyMoves,
	Record<string, never>,
	ParleyEvent,
	ParleyView
> = {
	name: "parley",

	schemas: {
		state: ParleyState,
		config: ParleyConfig,
		events: ParleyEvent,
		view: ParleyView,
		moves: { open: OpenInput, reply: ReplyInput, pass: PassInput }
	},

	setup: () => ( { log: [] } ),

	apply: ( state, event ) => ( { log: [ ...state.log, event.note ] } ),

	endIf: ( { state, config } ) =>
		state.log.filter( entry => entry.startsWith( "resolved:" ) ).length >= config.target,

	view: ( { state }, audience ) => ( { log: state.log, playerId: playerIdFor( audience ) } ),

	hooks: {},

	moves: {
		open: {
			validate: () => undefined,
			execute: ( data, playerId, input ) => [
				note( `open:${ input.kind }` ),
				...( input.beneath
					? [
						InteractionOpened.make( {
							frame: frameFor( data, playerId, { kind: "ghost" } )
						} )
					]
					: [] ),
				InteractionOpened.make( { frame: frameFor( data, playerId, input ) } )
			]
		},

		reply: {
			validate: ( { context }, _playerId, input ) => {
				if ( input.token === "bad" ) {
					return new InvalidMove( { move: "reply", reason: "That token is refused." } );
				}

				return context.interactions.length === 0
					? new InvalidMove( { move: "reply", reason: "Nothing to reply to." } )
					: undefined;
			},

			execute: ( _data, playerId, input ) => [ note( `reply:${ playerId }:${ input.value }` ) ]
		},

		pass: {
			validate: () => undefined,
			execute: ( _data, playerId ) => [ note( `pass:${ playerId }` ) ]
		}
	},

	interactions: {

		// Every default in place: the next responder in order answers, and the
		// frame resolves once all of them have. A frame marked `nest` hands off to
		// a `vote` as it closes, which is the nested case.
		duel: {
			responseMoves: [ "reply" ],

			resolve: ( _data, frame ) => frame.payload === "nest"
				? [
					note( "nested" ),
					InteractionOpened.make( {
						frame: InteractionFrame.make( {
							kind: "vote",
							initiator: frame.initiator,
							responders: frame.responders,
							mode: "simultaneous",
							responses: {}
						} )
					} )
				]
				: [ note( `resolved:duel:${ acceptedIn( frame ) }` ) ]
		},

		// Settles on two answers rather than all of them, runs its own clock, and
		// has somewhere to go when that clock runs out.
		vote: {
			responseMoves: [ "reply" ],
			timeoutMillis: 5_000,
			isComplete: ( _data, frame ) => Object.keys( frame.responses ).length >= 2,
			onTimeout: ( _data, frame ) => [ note( `resolved:vote:timeout:${ acceptedIn( frame ) }` ) ],
			resolve: ( _data, frame ) => [ note( `resolved:vote:${ acceptedIn( frame ) }` ) ]
		},

		// Only the player the frame names may answer, whatever the order.
		audit: {
			responseMoves: [ "reply" ],
			canRespond: ( _data, frame, playerId ) => playerId === frame.target,
			isComplete: ( _data, frame ) => Object.keys( frame.responses ).length >= 1,
			resolve: ( _data, frame ) => [ note( `resolved:audit:${ acceptedIn( frame ) }` ) ]
		}
	},

	/**
	 * Answers whatever frame is open, and passes otherwise. A `passive` table's
	 * policy declines to move at all, which is how a game *with* a policy still
	 * reaches the engine's force-settle path.
	 */
	botMove: ( { config, context } ) => {
		if ( config.passive ) {
			return undefined;
		}

		return context.interactions.length > 0
			? { moveType: "reply" as const, input: { value: true } }
			: { moveType: "pass" as const, input: {} };
	}
};

export const parleyEngine = makeEngine( parleyStructure );

/** The same game with no policy, so a frame can only ever be force-settled. */
const policylessStructure: GameStructure<
	"parley",
	ParleyState,
	ParleyConfig,
	ParleyMoves,
	Record<string, never>,
	ParleyEvent,
	ParleyView
> = { ...parleyStructure, botMove: undefined };

export const policylessParleyEngine = makeEngine( policylessStructure );
