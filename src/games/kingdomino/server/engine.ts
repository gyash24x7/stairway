import {
	DeckShuffled,
	DominoDiscarded,
	DominoPlaced,
	DominoSelected,
	DraftDrawn,
	DraftPruned,
	KINGDOMINO_BOT_DELAY_MILLIS,
	KINGDOMINO_DEFAULT_BOARD_SIZE,
	KINGDOMINO_MOVE_TIMEOUT_MILLIS,
	KingdominoConfig,
	KingdominoEvent,
	KingdominoMoveSchemas,
	KingdominoState,
	KingdominoView,
	PlayerBoardCreated,
	SelectionOrderRecomputed,
	SelectionOrderSet
} from "@/games/kingdomino/schema";
import { decideMove } from "@/games/kingdomino/server/bot";
import {
	apply,
	calculateScore,
	canDominoBePlaced,
	CASTLES,
	claimsMade,
	claimsOwed,
	createBoard,
	DOMINO_DECK,
	dominoesHeld,
	draftPlayerOrder,
	drawDraft,
	getSelectionsPerPlayer,
	getValidPlacements,
	layDomino,
	nextInQueue,
	seatAt,
	standingsFor
} from "@/games/kingdomino/utils";
import { InvalidMove } from "@/swish/errors";
import { Standing, Standings } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { playerIdFor } from "@/swish/utils";


/**
 * The kingdomino game's runtime, built from its declarative structure.
 *
 * Yielding it builds the command surface the API layer drives the game through —
 * the lifecycle commands, `submitMove`, the history cursor and `getView`.
 *
 * The type arguments are inferred rather than written out, and only from the
 * literal at this call site: `schemas.moves` and `phases` are homomorphic mapped
 * types, so TypeScript recovers `MoveInputs` and `PhaseMoves` from the object
 * literals there and feeds them to the contravariant `MoveInputs[K][ "Type" ]`
 * positions in each move's `validate`/`execute`. Lift the structure out to a
 * `const` of its own and every one of those inference sites is gone — the
 * callback parameters fall back to `any` and the structure stops being
 * assignable. Which is why it is written here, inline.
 *
 * What shapes this game is that a round is two things at once: everyone lays the
 * domino they claimed last round, and everyone claims from the row turned up for
 * the next one. Both are driven by a single order — `state.selectionOrder`, one
 * slot per king — so the two are written as two phases that loop rather than as
 * one turn with two halves. `SELECT` draws the row and hands the claims out;
 * `PLACE` walks the same order again, one domino a slot. Splitting them is what
 * lets the turn cursor be a plain index into that order in both, and it is what
 * gives the bot the one thing it branches on: `context.phase`.
 */
export const {
	Engine: KingdominoEngine,
	EngineLive: KingdominoEngineLive,
	Structure: KingdominoStructure
} =
	makeEngine( {
		name: "kingdomino",

		schemas: {
			state: KingdominoState,
			config: KingdominoConfig,
			events: KingdominoEvent,
			view: KingdominoView,
			moves: KingdominoMoveSchemas
		},

		/**
		 * Four seats on the printed board, started as soon as they are full. A
		 * kingdomino stalls hard — every other seat's round waits on the one still
		 * deciding where its domino goes — so a seat that walks away is handed to the
		 * policy through `autoPlay` rather than leaving the table mid-draft.
		 */
		defaultConfig: () => KingdominoConfig.make( {
			playerCount: 4,
			boardSize: KINGDOMINO_DEFAULT_BOARD_SIZE,
			autoStart: true,
			botDelayMillis: KINGDOMINO_BOT_DELAY_MILLIS,
			moveTimeoutMillis: KINGDOMINO_MOVE_TIMEOUT_MILLIS
		} ),

		/**
		 * An empty table. `setup` runs at creation, when nobody has joined, so
		 * nothing here can be per-seat — and the deck is not seeded here either even
		 * though the config alone would size it, because `DeckShuffled` is what puts
		 * the shuffle in the log. Everything that makes a table is emitted at `start`.
		 */
		setup: () => KingdominoState.make( {
			playerData: {},
			deck: [],
			draft: [],
			selectionOrder: []
		} ),

		/**
		 * The reducer lives in `utils.ts`, beside the rules whose results it stores.
		 * Every branch of it is an assignment: the shuffled deck, the drawn row, the
		 * kingdom and its score were all computed where the randomness and the rules
		 * are, and ride their events here — which is what makes a replay, which re-runs
		 * this and nothing else, deal the same game twice.
		 */
		apply,

		/**
		 * Over when there is nothing left to draw and nothing left to lay.
		 *
		 * Both halves are needed, and the phase order is what makes them enough. A row
		 * is drawn on entering `SELECT`, and the engine asks this *before* the next
		 * phase is entered — so the deck still holds the final row when the round
		 * before it ends, and the table is only ever found empty-handed with an empty
		 * deck once the last claimed domino has been laid.
		 */
		endIf: ( { state, context } ) => context.players.length > 0
			&& state.deck.length === 0
			&& dominoesHeld( state ) === 0,

		/**
		 * Everything a seat holds was public from the moment it was claimed, so the
		 * standings are just the kingdoms read off the table: points, then the largest
		 * single property, then crowns, which is the rulebook's own tie-break chain.
		 * Seats level on all three share a rank and no winner is named — a shared
		 * victory is a result, not a tie to be broken by seating order.
		 */
		resolveResults: ( { state, context } ) => {
			const { ranking, winner } = standingsFor( context.players, state.playerData );

			return Standings.make( {
				ranking: ranking.map( standing => Standing.make( standing ) ),
				winner
			} );
		},

		/**
		 * Nothing is redacted but the deck, and the deck only as far as its order: a
		 * kingdom is built face up, the row on offer is on the table, and who claimed
		 * what is the whole point of the draft. What a client is not allowed to know is
		 * which dominoes are still to come, so the deck goes out as a count — enough to
		 * show the rounds left, not enough to plan against them.
		 */
		view: ( { state }, audience ) => KingdominoView.make( {
			playerData: state.playerData,
			draft: state.draft,
			selectionOrder: state.selectionOrder,
			deckCount: state.deck.length,
			playerId: playerIdFor( audience )
		} ),

		hooks: {

			/**
			 * Where the table is actually laid out: `setup` ran before anyone had joined,
			 * so the kingdoms and the opening order only exist here.
			 *
			 * The box is shuffled and cut to the rows this table will draw, and that one
			 * event is the whole of the shuffle — the deck rides the log rather than being
			 * redrawn, because `apply` is re-run on every replay and randomness there
			 * would deal a different game each time.
			 *
			 * The opening order is a slot per king rather than a seat per player, which is
			 * what makes a table of two work without a special case: each seat appears
			 * twice and the four are shuffled together, exactly as the kings are dropped
			 * on the first row.
			 */
			onStart: ( { config, context }, rng ) => {
				const kings = context.players.flatMap( playerId => Array.from(
					{ length: getSelectionsPerPlayer( config.playerCount ) },
					() => playerId
				) );

				return [
					DeckShuffled.make( { deck: rng( "deck" ).shuffle( DOMINO_DECK ) } ),
					...context.players.map( ( playerId, seat ) => PlayerBoardCreated.make( {
						playerId,
						board: createBoard( CASTLES[ seat % CASTLES.length ]!, config.boardSize )
					} ) ),
					SelectionOrderSet.make( { order: rng( "order" ).shuffle( kings ) } )
				];
			}
		},

		moves: {

			/**
			 * Claiming a domino from the row. The cursor already says whose slot it is, so
			 * all this has to check is that the domino is on the table and still going.
			 */
			selectDomino: {
				validate: ( { state }, _playerId, input ) => {
					const entry = state.draft.find( item => item.domino.id === input.dominoId );

					if ( !entry ) {
						return new InvalidMove( {
							move: "selectDomino",
							reason: "That domino is not in the row on offer."
						} );
					}

					if ( entry.selectedBy ) {
						return new InvalidMove( {
							move: "selectDomino",
							reason: "That domino has already been claimed."
						} );
					}

					return;
				},

				execute: ( _data, playerId, input ) => [
					DominoSelected.make( { dominoId: input.dominoId, playerId } )
				]
			},

			/**
			 * Laying the claimed domino in your own kingdom. Never anyone else's: the
			 * board this is checked and applied against is the acting seat's, read from
			 * the session rather than from the payload, so there is no kingdom to name.
			 */
			placeDomino: {
				validate: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ]!;
					const owed = nextInQueue( player );

					if ( owed === undefined ) {
						return new InvalidMove( {
							move: "placeDomino",
							reason: "You have no domino left to lay."
						} );
					}

					if ( input.placement.dominoId !== owed ) {
						return new InvalidMove( {
							move: "placeDomino",
							reason: `You must lay domino ${ owed } before any other.`
						} );
					}

					if ( !canDominoBePlaced( player.board, input.placement ) ) {
						return new InvalidMove( {
							move: "placeDomino",
							reason: "That domino does not fit there."
						} );
					}

					return;
				},

				/**
				 * The kingdom and its worth both ride the event rather than being recomputed
				 * by the reducer. Scoring is a fold over connected regions, and folding it
				 * once here keeps `apply` a plain assignment — which is what a replay wants,
				 * since it re-runs the reducer and nothing else.
				 */
				execute: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ]!;
					const board = layDomino( player.board, input.placement );

					return [
						DominoPlaced.make( {
							playerId,
							dominoId: input.placement.dominoId,
							board,
							score: calculateScore( board )
						} )
					];
				}
			},

			/**
			 * Giving up a domino that will not go anywhere. The rules allow it only when
			 * the kingdom genuinely has no room for it, so the legality is *checked* here
			 * rather than taken on trust — a discard a seat could reach at will would be a
			 * free way out of an awkward claim, and the whole cost of claiming greedily
			 * would go with it.
			 */
			discardDomino: {
				validate: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ]!;
					const owed = nextInQueue( player );

					if ( owed === undefined ) {
						return new InvalidMove( {
							move: "discardDomino",
							reason: "You have no domino left to give up."
						} );
					}

					if ( input.dominoId !== owed ) {
						return new InvalidMove( {
							move: "discardDomino",
							reason: `You must lay domino ${ owed } before any other.`
						} );
					}

					if ( getValidPlacements( player.board, input.dominoId ).length > 0 ) {
						return new InvalidMove( {
							move: "discardDomino",
							reason: "That domino still fits somewhere in your kingdom."
						} );
					}

					return;
				},

				execute: ( _data, playerId, input ) => [
					DominoDiscarded.make( { playerId, dominoId: input.dominoId } )
				]
			}
		},

		/**
		 * The policy sees the seat's own view, which in this game is very nearly the
		 * whole table — every kingdom is public and so is the row. What it does not see
		 * is the order of the deck, so it plays the draft on what is in front of it,
		 * exactly as the player it stands in for would.
		 */
		botMove: ( { state, context } ) => decideMove( state, context ),

		initialPhase: "SELECT",

		/**
		 * A round is one lap of this loop, and the loop is the whole game.
		 *
		 * `SELECT` is entered first, and entering it is what *makes* a round: its
		 * `onEnter` turns the next four dominoes face up, lowest id first, so there is
		 * one place a row is drawn rather than one for the first and another for the
		 * rest. Seats then claim in `state.selectionOrder`, one slot each, and the
		 * phase ends when the row has been claimed as far as it will be — three of the
		 * four at a table of three, which is where `onExit` throws the leftover out of
		 * the game and reads the *next* order off the claims, lowest domino first.
		 * Claiming a weak, low domino to buy an early pick is the only real decision
		 * this game offers, and that recomputation is where it is paid out.
		 *
		 * `PLACE` then walks that same freshly recomputed order, one domino a slot: the
		 * order a table claimed in is the order it lays in, which is what makes both
		 * cursors a plain index into one list. It ends when nobody is holding anything.
		 *
		 * Then `resolveNextPhase` points back at `SELECT` unconditionally. What stops
		 * the loop is the game's own `endIf`, asked *between* the exit and the entry:
		 * with the last domino laid and the deck out, the game completes and `SELECT`
		 * is never entered, so no empty row is ever turned up.
		 */
		phases: {
			SELECT: {
				moves: [ "selectDomino" ],

				/**
				 * The row rides the event, and so does what is left of the deck. Slicing the
				 * deck in the reducer instead would work, but only as long as the reducer's
				 * idea of how many were drawn never drifts from this one — and the log would
				 * then be a row short of saying what happened.
				 */
				onEnter: ( { state } ) => {
					const { draft, deck } = drawDraft( state.deck );
					return draft.length > 0 ? [ DraftDrawn.make( { draft, deck } ) ] : [];
				},

				resolveStartingPlayer: ( { state, context } ) =>
					seatAt( state, claimsMade( state ), context.players[ 0 ]! ),

				endIf: ( { state } ) => claimsMade( state ) >= claimsOwed( state ),

				/**
				 * Whoever holds the next unclaimed slot. Counting the claims already on the
				 * row rather than tracking an index of its own means the cursor is derived
				 * from the log like everything else, so an undo that takes a claim back also
				 * takes the turn back with it.
				 */
				resolveNextPlayer: ( { state, context } ) =>
					seatAt( state, claimsMade( state ), context.players[ 0 ]! ),

				/**
				 * The leftover is recorded as it leaves rather than recomputed later: it is
				 * out of the game, not back in the deck, and a replay should follow the log
				 * instead of re-deriving which quarter of which row nobody wanted.
				 */
				onExit: ( { state } ) => {
					const unclaimed = state.draft
						.filter( entry => !entry.selectedBy )
						.map( entry => entry.domino.id );

					const reordered = SelectionOrderRecomputed.make( {
						order: draftPlayerOrder( state.draft )
					} );

					return unclaimed.length > 0
						? [ DraftPruned.make( { dominoIds: unclaimed } ), reordered ]
						: [ reordered ];
				},

				resolveNextPhase: () => "PLACE"
			},

			PLACE: {
				moves: [ "placeDomino", "discardDomino" ],

				resolveStartingPlayer: ( { state, context } ) => seatAt( state, 0, context.players[ 0 ]! ),

				endIf: ( { state } ) => dominoesHeld( state ) === 0,

				/**
				 * The same index trick as the claim cursor, read from the other end: every
				 * slot of the round's order is one domino somebody is holding, so the number
				 * still held says how many slots are left and the difference says which slot
				 * is next. A discard counts as a placement for this, because it empties the
				 * queue just the same.
				 */
				resolveNextPlayer: ( { state, context } ) => seatAt(
					state,
					state.selectionOrder.length - dominoesHeld( state ),
					context.players[ 0 ]!
				),

				resolveNextPhase: () => "SELECT"
			}
		}
	} );
