import * as Match from "effect/Match";
import { produce } from "immer";

import type * as Types from "effect/Types";

import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";

import type { AuthInfo } from "@/auth/shared/schema.ts";
import type {
	Audience,
	BaseGameConfig,
	BaseGameEvent,
	EngineEvent,
	GameRecord,
	InteractionFrame,
	Standings
} from "@/swish/shared/schema.ts";

const isEngineEvent = ( event: { readonly _tag: string } ): event is EngineEvent =>
	event._tag.startsWith( "swish/ev/" );

/**
 * Applies an engine event to the current game data.
 * Context, Players, Phase, Status & Interactions are modified here.
 * State is modified by the game's apply function.
 *
 * @param data - The current game data
 * @param event - The engine event to apply.
 * @returns A new game data with the event applied
 */
export const engineApply =
	<State, Config extends BaseGameConfig>( data: GameRecord<State, Config>, event: EngineEvent ) =>
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

			Match.tag( "swish/ev/TeamNamed", ( e ) => produce( data, draft => {
				draft.context.teamNames ??= {};
				draft.context.teamNames[ e.team ] = e.name;
			} ) ),

			Match.tag( "swish/ev/SeatOrderSet", ( e ) => produce( data, draft => {
				draft.context.players = [ ...e.order ] as Types.DeepMutable<typeof e.order>;
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
				draft.results = e.results as Types.DeepMutable<Standings>;
			} ) ),

			Match.tag( "swish/ev/InteractionOpened", ( e ) => produce( data, draft => {
				draft.context.interactions.push( e.frame as Types.DeepMutable<InteractionFrame> );
			} ) ),

			Match.tag( "swish/ev/InteractionResponded", ( e ) => produce( data, draft => {
				if ( draft.context.interactions.length > 0 ) {
					const idx = draft.context.interactions.length - 1;
					const frame = draft.context.interactions[ idx ];
					frame.responses[ e.playerId ] = e.response;
					draft.context.interactions[ idx ] = frame;
				}
			} ) ),

			Match.tag( "swish/ev/InteractionResolved", () => produce( data, draft => {
				if ( draft.context.interactions.length > 0 ) {
					draft.context.interactions = draft.context.interactions.slice( 0, -1 );
				}
			} ) ),

			Match.tag( "swish/ev/SeatStatusChanged", ( e ) => produce( data, draft => {
				draft.context.seats[ e.playerId ] = e.status;
			} ) ),

			Match.exhaustive
		);

export class Accumulator<State, Config extends BaseGameConfig, Events extends BaseGameEvent> {

	constructor(
		private _work: GameRecord<State, Config>,
		private applyFn: ( state: State, event: Events ) => State
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
		this._events.push( ...events );
		this.fold( events );
	}

	private fold( events: Array<EngineEvent | Events> ) {
		this._work = events.reduce(
			( acc, event ) => isEngineEvent( event )
				? engineApply( acc, event )
				: { ...acc, state: this.applyFn( acc.state, event ) },
			this.work
		);
	}
}

export const toPlayerInfo = ( user: AuthInfo ) =>
	PlayerInfo.make( {
		id: PlayerId.make( user.id ),
		name: user.name,
		avatar: user.avatar
	} );

export const playerIdFor = ( audience: Audience ) =>
	Match.value( audience ).pipe(
		Match.tag( "swish/PlayerAudience", audience => audience.playerId ),
		Match.tag( "swish/TableAudience", () => undefined ),
		Match.exhaustive
	);
