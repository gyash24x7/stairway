import * as Match from "effect/Match";

import { castDraft, produce } from "immer";

import type { BaseGameConfig, BaseGameEvent, EngineEvent, GameRecord } from "@/swish/schema";
import { InteractionFrame, InteractionResponse, SuspendedTurn } from "@/swish/schema";


const isEngineEvent = ( event: { readonly _tag: string } ): event is EngineEvent =>
	event._tag.startsWith( "swish/ev/" );


// --- Engine Events Reducer --------------------------------------------------

/**
 * Applies an engine event to the current game data.
 * Context, Players, Phase, & Status are modified here.
 * State is modified by the game's apply function.
 *
 * @param data - The current game data
 * @param event - The engine event to apply.
 * @returns A new game data with the event applied
 */
export const engineApply =
	<State, Config extends BaseGameConfig>
	( data: GameRecord<State, Config>, event: EngineEvent ) =>
		Match.value( event ).pipe(
			Match.tag( "swish/ev/PlayerJoined", ( e ) => produce( data, draft => {
				draft.players[ e.player.id ] = e.player;

				if ( draft.context.players.length === 0 ) {
					draft.context.currentPlayer = e.player.id;
				}

				draft.context.players.push( e.player.id );
			} ) ),

			Match.tag( "swish/ev/TeamAssigned", ( e ) => produce( data, draft => {
				draft.context.teams ??= {};
				draft.context.teams[ e.playerId ] = e.team;
			} ) ),

			Match.tag( "swish/ev/TeamLeft", ( e ) => produce( data, draft => {
				delete draft.context.teams[ e.playerId ];
			} ) ),

			Match.tag( "swish/ev/TeamNamed", ( e ) => produce( data, draft => {
				draft.context.teamNames ??= {};
				draft.context.teamNames[ e.team ] = e.name;
			} ) ),

			Match.tag( "swish/ev/SeatOrderSet", ( e ) => produce( data, draft => {
				draft.context.players = castDraft( e.order );
			} ) ),

			Match.tag( "swish/ev/CurrentPlayerSet", ( e ) => produce( data, draft => {
				draft.context.currentPlayer = e.playerId;
			} ) ),

			Match.tag( "swish/ev/TurnAdvanced", () => produce( data, draft => {
				draft.context.turn++;
			} ) ),

			Match.tag( "swish/ev/PhaseEntered", ( e ) => produce( data, draft => {
				draft.context.phase = e.phase;
			} ) ),

			Match.tag( "swish/ev/PhaseExited", () => data ),

			Match.tag( "swish/ev/StatusChanged", ( e ) => produce( data, draft => {
				draft.status = e.status;
			} ) ),

			Match.tag( "swish/ev/GameCompleted", () => produce( data, draft => {
				draft.status = "COMPLETED";
			} ) ),

			Match.tag( "swish/ev/ResultsResolved", ( e ) => produce( data, draft => {
				draft.results = castDraft( e.results );
			} ) ),

			Match.tag( "swish/ev/InteractionOpened", ( e ) => produce( data, draft => {
				const frame = InteractionFrame.make( {
					id: String( draft.context.interactionCount ),
					kind: e.kind,
					initiator: e.initiator,
					subject: e.subject,
					responders: e.responders,
					pending: e.responders,
					responses: [],
					options: e.options ?? [],
					resolution: e.resolution ?? "first",
					allowPass: e.allowPass ?? true,
					secret: e.secret ?? false,
					timeoutMillis: e.timeoutMillis,
					openedAtTurn: draft.context.turn
				} );

				draft.context.interactions.push( castDraft( frame ) );
				draft.context.interactionCount++;
			} ) ),

			Match.tag( "swish/ev/InteractionResponded", ( e ) => produce( data, draft => {
				const frame = draft.context.interactions.find( ( { id } ) => id === e.frameId );
				if ( !frame ) {
					return;
				}

				const response = InteractionResponse.make( {
					playerId: e.playerId,
					move: e.move,
					outcome: "answered"
				} );

				frame.responses.push( response );
				frame.pending = frame.resolution === "first"
					? []
					: frame.pending.filter( playerId => playerId !== e.playerId );
			} ) ),

			Match.tag( "swish/ev/InteractionPassed", ( e ) => produce( data, draft => {
				const frame = draft.context.interactions.find( ( { id } ) => id === e.frameId );
				if ( !frame ) {
					return;
				}

				const response = InteractionResponse.make( { playerId: e.playerId, outcome: "passed" } );
				frame.responses.push( response );
				frame.pending = frame.pending.filter( playerId => playerId !== e.playerId );
			} ) ),

			Match.tag( "swish/ev/InteractionExpired", ( e ) => produce( data, draft => {
				const frame = draft.context.interactions.find( ( { id } ) => id === e.frameId );
				if ( !frame ) {
					return;
				}

				const response = InteractionResponse.make( { playerId: e.playerId, outcome: "expired" } );
				frame.responses.push( response );
				frame.pending = frame.pending.filter( playerId => playerId !== e.playerId );
			} ) ),

			Match.tag( "swish/ev/InteractionClosed", ( e ) => produce( data, draft => {
				draft.context.interactions = draft.context.interactions
					.filter( ( { id } ) => id !== e.frameId );
			} ) ),

			Match.tag( "swish/ev/TurnSuspended", ( e ) => produce( data, draft => {
				draft.context.suspended = SuspendedTurn.make( { actor: e.actor, moveType: e.moveType } );
			} ) ),

			Match.tag( "swish/ev/TurnResumed", () => produce( data, draft => {
				draft.context.suspended = undefined;
			} ) ),

			Match.exhaustive
		);


/**
 * Folds a batch of events onto a record, routing each to the reducer that owns
 * it: engine events (`swish/ev/…`) change the header and the context, the game's
 * own events change `state` and nothing else.
 *
 * The single fold in the engine. A commit runs it through the `Accumulator` as
 * events are produced; `replay` runs it over the log to rebuild a record from
 * genesis. Both paths therefore exercise the same reducer, which is what makes
 * an undo — a re-fold from the opening position — trustworthy.
 *
 * @param record - The record to fold onto.
 * @param events - The events to apply, in order.
 * @param apply - The game's own reducer, for events the engine does not own.
 * @returns A new record with every event applied.
 */
export const foldEvents = <State, Config extends BaseGameConfig, Events extends BaseGameEvent>(
	record: GameRecord<State, Config>,
	events: Iterable<EngineEvent | Events>,
	apply: ( state: State, event: Events ) => State
) => {
	let folded = record;
	for ( const event of events ) {
		folded = isEngineEvent( event )
			? engineApply( folded, event )
			: { ...folded, state: apply( folded.state, event ) };
	}

	return folded;
};


// --- Event Accumulator ---------------------------------------------------------

export class Accumulator<State, Config extends BaseGameConfig, Events extends BaseGameEvent> {

	/**
	 * @param _work - The record events are folded onto as they arrive.
	 * @param applyFn - The game's own reducer.
	 * @param normalise - Fills an event in before it is recorded. The engine uses
	 * 		it for one thing: an `InteractionOpened` a game emitted with only the
	 * 		bones of a window, which is completed from that window kind's declaration
	 * 		here so the log holds the whole thing. It runs on the way *in* and never
	 * 		on the way out — `foldEvents` and `replay` read what was stored and take
	 * 		it as final, so a structure whose defaults change tomorrow cannot
	 * 		reinterpret a game played today.
	 */
	constructor(
		private _work: GameRecord<State, Config>,
		private applyFn: ( state: State, event: Events ) => State,
		private normalise?: ( event: EngineEvent | Events ) => EngineEvent | Events
	) {}

	private _events: Array<Events | EngineEvent> = [];

	get events() {
		return [ ...this._events ];
	}

	get work() {
		return this._work;
	}

	public getGameData() {
		const { state, config, context } = this.work;
		return { state, config, context };
	}

	public accumulate( ...events: Array<EngineEvent | Events> ) {
		const prepared = this.normalise ? events.map( this.normalise ) : events;
		this._events.push( ...prepared );
		this.fold( prepared );
	}

	private fold( events: Array<EngineEvent | Events> ) {
		this._work = foldEvents( this.work, events, this.applyFn );
	}
}
