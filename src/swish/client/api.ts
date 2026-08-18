import type * as Effect from "effect/Effect";

import { run } from "@/client.ts";

import type { GameId } from "@/swish/shared/schema.ts";

// --- Endpoint wrappers -------------------------------------------------------
//
// The three request shapes `swish/shared/contract.ts` builds, wrapped once so a
// game's `client/client.ts` is a list of its endpoints rather than a list of
// hand-written `run( client.<game>.<endpoint>( { … } ) )` calls.
//
// Each wrapper takes the generated client method and hands back the call a
// component wants — the path param spelled out as an argument, the Effect run as
// a Promise for TanStack Query, and the query's `AbortSignal` forwarded. The
// endpoint's payload and success types flow through untouched, so picking the
// wrong wrapper for an endpoint is a type error where that call is used.

/** The path params every per-game endpoint carries. */
type GameParams = { readonly params: { readonly gameId: GameId } };

/**
 * A payload argument, optional when the endpoint's input is empty — a game like
 * tictactoe is configured entirely by its rules, and a move like `pass` or
 * `forfeit` says everything by being played.
 */
type PayloadArgs<Payload> = {} extends Payload
	? [ payload?: Payload, signal?: AbortSignal ]
	: [ payload: Payload, signal?: AbortSignal ];

/** Fills in the payload an endpoint taking the empty struct was called without. */
const orEmpty = <Payload>( payload: Payload | undefined ) => payload ?? ( {} as Payload );

/**
 * Wraps an endpoint whose request is only its payload — `createGame` and `join`,
 * which name no game because they are what produce one.
 *
 * @param endpoint - The generated client method.
 * @returns The call, taking the payload.
 */
export const inputFn = <Payload, A, E>(
	endpoint: ( request: { readonly payload: Payload } ) => Effect.Effect<A, E>
) => ( ...[ payload, signal ]: PayloadArgs<Payload> ) =>
	run( endpoint( { payload: orEmpty( payload ) } ), signal );

/**
 * Wraps an endpoint whose request is only the game it addresses — `getView`,
 * `addBots`, `start`, `undo` and `redo`, all of which read the caller from the
 * session.
 *
 * @param endpoint - The generated client method.
 * @returns The call, taking the game's id.
 */
export const gameFn = <A, E>(
	endpoint: ( request: GameParams ) => Effect.Effect<A, E>
) => ( gameId: GameId, signal?: AbortSignal ) =>
	run( endpoint( { params: { gameId } } ), signal );

/**
 * Wraps an endpoint that addresses a game and carries a payload — every move,
 * plus `setAutoPlay`, `joinTeam` and `nameTeam`.
 *
 * @param endpoint - The generated client method.
 * @returns The call, taking the game's id and the payload.
 */
export const gameInputFn = <Payload, A, E>(
	endpoint: ( request: GameParams & { readonly payload: Payload } ) => Effect.Effect<A, E>
) => ( gameId: GameId, ...[ payload, signal ]: PayloadArgs<Payload> ) =>
	run( endpoint( { params: { gameId }, payload: orEmpty( payload ) } ), signal );
