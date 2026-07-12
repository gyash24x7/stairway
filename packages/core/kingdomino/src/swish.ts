// @s2h/kingdomino/swish — Kingdomino as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old `AbstractGameEngine` DO). Same rules,
// re-expressed under event sourcing: the deciders (`setup`, phase `onEnter`,
// hooks, `execute`) EMIT domain events and a pure `apply` reducer folds them
// onto `state` (the ONLY place state changes). All the pure board helpers in
// ./utils are reused as-is.
//
// PHASED game: SELECT (draft dominoes) and PLACE (place / discard) phases, just
// like the old engine's `definePhasedGame`.
//
// Nondeterminism (deck shuffle, per-round draft draw, and the shuffled first
// selection order) lives in the deciders and is CAPTURED in the emitted events'
// payloads — the drawn dominoes / shuffled orders travel in the event so replay
// is exact. `apply` never calls `Math.random`.

import { Effect, Match, Schema } from "effect";
import { RpcGroup } from "effect/unstable/rpc";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { definePhasedGame } from "@s2h/swish/structure";
import { shuffle } from "@s2h/utils/array";
import type { Board as BoardT, Placement as PlacementT } from "./types";
import {
	applyPlacement,
	calculateScore,
	calculateShift,
	canDominoBePlaced,
	CASTLES,
	createBoard,
	DOMINO_DECK,
	getPlacementCoordinates,
	getPlayerSelectionCount,
	getSelectionOrderFromDraft,
	getSelectionsPerPlayer,
	getShiftedTiles,
	getValidPlacements
} from "./utils";

// --- Schemas ---------------------------------------------------------------

const Terrain = Schema.Literals( [
	"castle",
	"desert",
	"forest",
	"water",
	"grassland",
	"wasteland",
	"mine"
] );

const Tile = Schema.Struct( {
	terrain: Terrain,
	crowns: Schema.Number
} );

const Domino = Schema.Struct( {
	id: Schema.Number,
	left: Tile,
	right: Tile
} );

const Coord = Schema.Struct( { x: Schema.Number, y: Schema.Number } );
const Rotation = Schema.Literals( [ 0, 90, 180, 270 ] );
const Castle = Schema.Literals( [ "red", "blue", "yellow", "green" ] );
const BoardSize = Schema.Literals( [ 5, 7 ] );

const Placement = Schema.Struct( {
	dominoId: Schema.Number,
	coord: Coord,
	rotation: Rotation
} );

const Board = Schema.Struct( {
	size: BoardSize,
	castle: Castle,
	placements: Schema.Array( Placement ),
	tiles: Schema.Record( Schema.String, Tile )
} );

const Region = Schema.Struct( {
	id: Schema.String,
	terrain: Terrain,
	tiles: Schema.Number,
	placement: Schema.Array( Coord ),
	crowns: Schema.Number,
	points: Schema.Number
} );

const ScoreBreakdown = Schema.Struct( {
	regions: Schema.Array( Region ),
	points: Schema.Number
} );

const PlayerData = Schema.Struct( {
	board: Board,
	queue: Schema.Array( Schema.Number ),
	score: ScoreBreakdown
} );

const DraftEntry = Schema.Struct( {
	domino: Domino,
	selectedBy: Schema.optional( PlayerId )
} );

export const KingdominoConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.optional( Schema.Boolean ),
	boardSize: BoardSize
} );

export const KingdominoState = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerData ),
	deck: Schema.Array( Domino ),
	draft: Schema.Array( DraftEntry ),
	selectionOrder: Schema.Array( PlayerId ),
	winner: Schema.optional( PlayerId )
} );

// Shared view hides the remaining deck (the same `Omit<…, "deck">` as before).
export const KingdominoShared = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerData ),
	draft: Schema.Array( DraftEntry ),
	selectionOrder: Schema.Array( PlayerId ),
	winner: Schema.optional( PlayerId )
} );

export const KingdominoPlayer = Schema.Struct( { playerId: PlayerId } );

// One input schema per move (the RPC wire shape for each).
export const SelectDominoInput = Schema.Struct( { dominoId: Schema.Number } );
export const PlaceDominoInput = Schema.Struct( { placement: Placement } );
export const DiscardDominoInput = Schema.Struct( { dominoId: Schema.Number } );

type KingdominoState = typeof KingdominoState.Type;
type PlayerDataType = typeof PlayerData.Type;
type PlacementType = typeof Placement.Type;

// --- Domain events + reducer -----------------------------------------------
// Each event captures the exact (already-resolved, possibly random) data so the
// pure `apply` reducer can fold it deterministically.

/** Deck was shuffled at setup — carries the exact shuffled deck. */
const DeckShuffled = Schema.TaggedStruct( "kingdomino/DeckShuffled", {
	deck: Schema.Array( Domino )
} );

/** A player joined — their empty board (with castle) is seeded. */
const PlayerBoardCreated = Schema.TaggedStruct( "kingdomino/PlayerBoardCreated", {
	playerId: PlayerId,
	board: Board
} );

/** The shuffled first-round selection order was decided at start. */
const SelectionOrderSet = Schema.TaggedStruct( "kingdomino/SelectionOrderSet", {
	order: Schema.Array( PlayerId )
} );

/** A new draft was drawn from the deck — carries the drawn entries + remaining deck. */
const DraftDrawn = Schema.TaggedStruct( "kingdomino/DraftDrawn", {
	draft: Schema.Array( DraftEntry ),
	deck: Schema.Array( Domino )
} );

/** Unselected draft entries were dropped when the SELECT phase exited. */
const DraftPruned = Schema.TaggedStruct( "kingdomino/DraftPruned", {} );

/** A player claimed a draft domino; it enters their placement queue. */
const DominoSelected = Schema.TaggedStruct( "kingdomino/DominoSelected", {
	dominoId: Schema.Number,
	playerId: PlayerId
} );

/**
 * A domino was placed. Because a placement may shift the whole board, the
 * decider computes the resulting board + score and stores them in the event so
 * `apply` is a pure assignment.
 */
const DominoPlaced = Schema.TaggedStruct( "kingdomino/DominoPlaced", {
	playerId: PlayerId,
	dominoId: Schema.Number,
	board: Board,
	score: ScoreBreakdown
} );

/** A domino that could not be legally placed was discarded from the queue. */
const DominoDiscarded = Schema.TaggedStruct( "kingdomino/DominoDiscarded", {
	playerId: PlayerId,
	dominoId: Schema.Number
} );

/** The next-round selection order was recomputed from the resolved draft. */
const SelectionOrderRecomputed = Schema.TaggedStruct( "kingdomino/SelectionOrderRecomputed", {
	order: Schema.Array( PlayerId )
} );

/** The winner (highest score) was decided at game end. */
const WinnerDecided = Schema.TaggedStruct( "kingdomino/WinnerDecided", {
	winner: PlayerId
} );

const KingdominoEvent = Schema.Union( [
	DeckShuffled,
	PlayerBoardCreated,
	SelectionOrderSet,
	DraftDrawn,
	DraftPruned,
	DominoSelected,
	DominoPlaced,
	DominoDiscarded,
	SelectionOrderRecomputed,
	WinnerDecided
] );
type KingdominoEvent = typeof KingdominoEvent.Type;

/** Pure reducer — the ONLY place `state` changes. No Effect, no Random. */
const apply = ( state: KingdominoState, event: KingdominoEvent ): KingdominoState =>
	Match.value( event ).pipe(
		Match.tag( "kingdomino/DeckShuffled", ( e ) => ( { ...state, deck: e.deck } ) ),
		Match.tag( "kingdomino/PlayerBoardCreated", ( e ) => ( {
			...state,
			playerData: {
				...state.playerData,
				[ e.playerId ]: { board: e.board, queue: [], score: { regions: [], points: 0 } }
			}
		} ) ),
		Match.tag( "kingdomino/SelectionOrderSet", ( e ) => ( { ...state, selectionOrder: e.order } ) ),
		Match.tag( "kingdomino/DraftDrawn", ( e ) => ( { ...state, draft: e.draft, deck: e.deck } ) ),
		Match.tag( "kingdomino/DraftPruned", () => ( {
			...state,
			draft: state.draft.filter( ( entry ) => !!entry.selectedBy )
		} ) ),
		Match.tag( "kingdomino/DominoSelected", ( e ) => {
			const draft = state.draft.map( ( entry ) =>
				entry.domino.id === e.dominoId ? { ...entry, selectedBy: e.playerId } : entry );
			const player = state.playerData[ e.playerId ];
			return {
				...state,
				draft,
				playerData: {
					...state.playerData,
					[ e.playerId ]: { ...player, queue: [ ...player.queue, e.dominoId ] }
				}
			};
		} ),
		Match.tag( "kingdomino/DominoPlaced", ( e ) => {
			const player = state.playerData[ e.playerId ];
			return {
				...state,
				playerData: {
					...state.playerData,
					[ e.playerId ]: {
						...player,
						board: e.board,
						score: e.score,
						queue: player.queue.filter( ( id ) => id !== e.dominoId )
					}
				}
			};
		} ),
		Match.tag( "kingdomino/DominoDiscarded", ( e ) => {
			const player = state.playerData[ e.playerId ];
			return {
				...state,
				playerData: {
					...state.playerData,
					[ e.playerId ]: { ...player, queue: player.queue.filter( ( id ) => id !== e.dominoId ) }
				}
			};
		} ),
		Match.tag( "kingdomino/SelectionOrderRecomputed", ( e ) => ( { ...state, selectionOrder: e.order } ) ),
		Match.tag( "kingdomino/WinnerDecided", ( e ) => ( { ...state, winner: e.winner } ) ),
		Match.exhaustive
	);

// --- helpers (bridge the schema-decoded shapes to the ./utils functions) ----
// The ./utils helpers speak the ./types structural shapes; the schema `.Type`s
// are structurally identical (readonly), so we cast at the boundary.

const asBoard = ( board: PlayerDataType[ "board" ] ): BoardT => board as unknown as BoardT;
const asPlacement = ( placement: PlacementType ): PlacementT => placement as unknown as PlacementT;
const asBoardResult = ( board: BoardT ): typeof Board.Type => board as unknown as typeof Board.Type;
const asScoreResult = ( score: ReturnType<typeof calculateScore> ): typeof ScoreBreakdown.Type =>
	score as unknown as typeof ScoreBreakdown.Type;

/**
 * The selection order derived from the resolved draft, cast to the swish
 * (branded) `PlayerId`. `getSelectionOrderFromDraft` speaks the engine's
 * `PlayerId` (from ./types); the two are structurally identical strings.
 */
const draftPlayerOrder = ( draft: KingdominoState[ "draft" ] ): ReadonlyArray<PlayerId> =>
	getSelectionOrderFromDraft( [ ...draft ] as never ) as unknown as ReadonlyArray<PlayerId>;

const DRAFT_SIZE = 4;

/** Pure, deterministic draft draw from a given deck (no mutation). */
const drawDraftPure = ( deck: ReadonlyArray<typeof Domino.Type> ) => {
	const count = Math.min( DRAFT_SIZE, deck.length );
	const drawn = deck.slice( 0, count )
		.slice()
		.sort( ( a, b ) => a.id - b.id )
		.map( ( domino ) => ( { domino } ) );
	const rest = deck.slice( count );
	return { draft: drawn, deck: rest };
};

// --- Engine ----------------------------------------------------------------

export const kingdomino = makeEngine(
	definePhasedGame( {
		name: "kingdomino",
		stateSchema: KingdominoState,
		configSchema: KingdominoConfig,
		sharedViewSchema: KingdominoShared,
		playerViewSchema: KingdominoPlayer,
		eventSchema: KingdominoEvent,
		apply,

		// setup: initial state has an EMPTY deck; the shuffle is emitted as the
		// first event of `onStart`-adjacent flow. We shuffle here (nondeterministic)
		// but capture it via `DeckShuffled` so the log holds the exact deck.
		setup: () => Effect.succeed( {
			playerData: {},
			deck: [],
			draft: [],
			selectionOrder: []
		} ),

		endIf: ( { state, context } ) => {
			const allQueuesEmpty = context.players.every( ( pid ) =>
				( state.playerData[ pid ]?.queue.length ?? 0 ) === 0 );
			const allDraftResolved = state.draft.every( ( entry ) => !!entry.selectedBy );
			return Effect.succeed( allQueuesEmpty && state.deck.length === 0 && allDraftResolved );
		},

		sharedView: ( { state } ) => {
			const { deck: _deck, ...rest } = state;
			return Effect.succeed( rest );
		},
		playerView: ( _data, playerId ) => Effect.succeed( { playerId } ),

		hooks: {
			// Seed each joiner's board (castle by join index). Config supplies boardSize.
			onJoin: ( { state, config }, playerId ) => {
				const castleIndex = Object.keys( state.playerData ).length;
				const board = createBoard( CASTLES[ castleIndex ], config.boardSize );
				return Effect.succeed( [
					PlayerBoardCreated.make( { playerId, board: asBoardResult( board ) } )
				] );
			},

			// At start: shuffle the deck (captured) and shuffle the first-round
			// selection order (captured). Deterministic replay via the events.
			onStart: ( { context } ) => {
				const deck = shuffle( [ ...DOMINO_DECK ] );
				const selections = getSelectionsPerPlayer( context.players.length );
				const slots = context.players.flatMap( ( pid ) => Array( selections ).fill( pid ) );
				const order = shuffle( slots ) as ReadonlyArray<PlayerId>;
				return Effect.succeed( [
					DeckShuffled.make( { deck: deck as ReadonlyArray<typeof Domino.Type> } ),
					SelectionOrderSet.make( { order } )
				] );
			},

			onEnd: ( { state, context } ) => {
				const players = context.players;
				const winner = players.reduce( ( best, pid ) =>
					( state.playerData[ pid ]?.score.points ?? 0 ) > ( state.playerData[ best ]?.score.points ?? 0 )
						? pid
						: best );
				return Effect.succeed( [ WinnerDecided.make( { winner } ) ] );
			}
		},

		initialPhase: "SELECT",

		phases: {
			SELECT: {
				// Draw the next draft from the (already-shuffled) deck. The drawn
				// entries + remaining deck are captured so replay is exact.
				onEnter: ( { state } ) => {
					if ( state.deck.length === 0 ) {
						return Effect.succeed( [] );
					}
					const { draft, deck } = drawDraftPure( state.deck );
					return Effect.succeed( [ DraftDrawn.make( { draft, deck } ) ] );
				},

				// Drop the unselected draft entries.
				onExit: () => Effect.succeed( [ DraftPruned.make( {} ) ] ),

				resolveStartingPlayer: ( { state, context } ) =>
					Effect.succeed(
						state.selectionOrder.length > 0
							? state.selectionOrder[ 0 ]
							: context.players[ 0 ]
					),

				moves: {
					selectDomino: {
						input: SelectDominoInput,
						validate: ( { state, context: { players } }, playerId, { dominoId } ) => {
							const entry = state.draft.find( ( e ) => e.domino.id === dominoId );
							if ( !entry ) {
								return Effect.fail(
									new InvalidMove( { move: "selectDomino", reason: "Domino not in draft!" } ) );
							}
							if ( entry.selectedBy ) {
								return Effect.fail(
									new InvalidMove( { move: "selectDomino", reason: "Domino already selected!" } ) );
							}
							const selectionsPerPlayer = getSelectionsPerPlayer( players.length );
							const playerSelections = getPlayerSelectionCount( [ ...state.draft ], playerId );
							if ( playerSelections >= selectionsPerPlayer ) {
								return Effect.fail( new InvalidMove( {
									move: "selectDomino",
									reason: "Already selected maximum dominos this round!"
								} ) );
							}
							return Effect.void;
						},
						execute: ( _data, playerId, { dominoId } ) =>
							Effect.succeed( [ DominoSelected.make( { dominoId, playerId } ) ] )
					}
				},

				resolveNextPlayer: ( { state } ) => {
					const consumed = state.draft.filter( ( e ) => !!e.selectedBy ).length;
					return Effect.succeed( state.selectionOrder[ consumed ] ?? state.selectionOrder[ 0 ] );
				},

				endIf: ( { state } ) =>
					Effect.succeed(
						state.draft.filter( ( e ) => !!e.selectedBy ).length >= state.selectionOrder.length
					),

				resolveNextPhase: () => Effect.succeed( "PLACE" )
			},

			PLACE: {
				resolveStartingPlayer: ( { state } ) => {
					const draftOrder = draftPlayerOrder( state.draft );
					return Effect.succeed( draftOrder[ 0 ] );
				},

				moves: {
					placeDomino: {
						input: PlaceDominoInput,
						canMove: ( { state }, playerId ) =>
							Effect.succeed( ( state.playerData[ playerId ]?.queue.length ?? 0 ) > 0 ),
						validate: ( { state }, playerId, { placement } ) => {
							const player = state.playerData[ playerId ];
							if ( !player.queue.includes( placement.dominoId ) ) {
								return Effect.fail(
									new InvalidMove( { move: "placeDomino", reason: "Domino not in your queue!" } ) );
							}
							const lowest = Math.min( ...player.queue );
							if ( placement.dominoId !== lowest ) {
								return Effect.fail(
									new InvalidMove( { move: "placeDomino", reason: "Place lower-id domino first!" } ) );
							}
							if ( !canDominoBePlaced( asBoard( player.board ), asPlacement( placement ) ) ) {
								return Effect.fail(
									new InvalidMove( { move: "placeDomino", reason: "Invalid placement!" } ) );
							}
							return Effect.void;
						},
						execute: ( { state }, playerId, { placement: input } ) => {
							const player = state.playerData[ playerId ];
							let board = asBoard( player.board );
							let placement = asPlacement( input );

							const coords = getPlacementCoordinates( placement );
							const shift = calculateShift( coords, board.size );
							if ( shift.x !== 0 || shift.y !== 0 ) {
								const shiftedTiles = getShiftedTiles( board, shift );
								if ( shiftedTiles ) {
									board = { ...board, tiles: shiftedTiles };
									placement = {
										...placement,
										coord: {
											x: placement.coord.x + shift.x,
											y: placement.coord.y + shift.y
										}
									};
								}
							}

							const nextBoard = applyPlacement( board, placement );
							const score = calculateScore( nextBoard );
							return Effect.succeed( [ DominoPlaced.make( {
								playerId,
								dominoId: input.dominoId,
								board: asBoardResult( nextBoard ),
								score: asScoreResult( score )
							} ) ] );
						}
					},

					discardDomino: {
						input: DiscardDominoInput,
						canMove: ( { state }, playerId ) =>
							Effect.succeed( ( state.playerData[ playerId ]?.queue.length ?? 0 ) > 0 ),
						validate: ( { state }, playerId, { dominoId } ) => {
							const player = state.playerData[ playerId ];
							if ( !player.queue.includes( dominoId ) ) {
								return Effect.fail(
									new InvalidMove( { move: "discardDomino", reason: "Domino not in your queue!" } ) );
							}
							const lowest = Math.min( ...player.queue );
							if ( dominoId !== lowest ) {
								return Effect.fail( new InvalidMove( {
									move: "discardDomino",
									reason: "Discard lower-id domino first!"
								} ) );
							}
							const validPlacements = getValidPlacements( asBoard( player.board ), dominoId );
							if ( validPlacements.length > 0 ) {
								return Effect.fail(
									new InvalidMove( { move: "discardDomino", reason: "Domino can still be placed!" } ) );
							}
							return Effect.void;
						},
						execute: ( _data, playerId, { dominoId } ) =>
							Effect.succeed( [ DominoDiscarded.make( { playerId, dominoId } ) ] )
					}
				},

				resolveNextPlayer: ( { state } ) => {
					const draftOrder = draftPlayerOrder( state.draft );
					const nextPlacer = draftOrder.find( ( pid ) =>
						( state.playerData[ pid ]?.queue.length ?? 0 ) > 0 );
					return Effect.succeed( nextPlacer ?? draftOrder[ 0 ] );
				},

				endIf: ( { state, context } ) =>
					Effect.succeed( context.players.every(
						( pid ) => ( state.playerData[ pid ]?.queue.length ?? 0 ) === 0
					) ),

				// Recompute next-round selection order from the resolved draft.
				onExit: ( { state } ) => {
					const order = draftPlayerOrder( state.draft );
					return Effect.succeed( [ SelectionOrderRecomputed.make( { order } ) ] );
				},

				resolveNextPhase: () => Effect.succeed( "SELECT" )
			}
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class KingdominoRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( KingdominoConfig ),
	EngineRpc.makeGetState( KingdominoShared, KingdominoPlayer ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "selectDomino", SelectDominoInput ),
	EngineRpc.makeForMove( "placeDomino", PlaceDominoInput ),
	EngineRpc.makeForMove( "discardDomino", DiscardDominoInput ),
	EngineRpc.makeUndo( KingdominoShared, KingdominoPlayer ),
	EngineRpc.makeRedo( KingdominoShared, KingdominoPlayer )
) {
	public static layer = KingdominoRpcs.toLayer( {
		initialize: kingdomino.initialize,
		getState: kingdomino.getState,
		join: kingdomino.join,
		addBots: kingdomino.addBots,
		start: kingdomino.start,
		undo: kingdomino.undo,
		redo: kingdomino.redo,
		selectDomino: ( { playerInfo, input } ) =>
			kingdomino.submitMove( "selectDomino", playerInfo, input ),
		placeDomino: ( { playerInfo, input } ) =>
			kingdomino.submitMove( "placeDomino", playerInfo, input ),
		discardDomino: ( { playerInfo, input } ) =>
			kingdomino.submitMove( "discardDomino", playerInfo, input )
	} );
}
