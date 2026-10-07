import * as HashSet from "effect/HashSet";

import { assert, describe, it } from "@effect/vitest";

import { makeRng } from "@/shared/utils/rng";
import type {
	BaseGameConfig,
	GameContext,
	GameRecord,
	GameRuntime,
	InteractionFrame,
	PlayerId,
	Standings,
	TeamId
} from "@/swish/schema";
import {
	GameContext as Context,
	InteractionFrame as Frame,
	InteractionOption,
	InteractionResponse,
	PlayerAudience,
	TableAudience
} from "@/swish/schema";
import {
	activeFrame,
	activeFrameChanged,
	answersOf,
	areTeammates,
	balanceTeams,
	canRespond,
	compileStandings,
	firstAnswer,
	frameById,
	interleaveSeats,
	isMachinePlayed,
	isSettled,
	membersOf,
	nameOf,
	nextInOrder,
	opponentsOf,
	optionsFor,
	pendingActorsChanged,
	pendingSeatChanged,
	redactInteractions,
	replay,
	resolveClock,
	responseOf,
	teamMatesOf,
	teamOf,
	teamSize,
	validateTeamConfig
} from "@/swish/utils";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;
const dave = "dave" as PlayerId;

const ONE = "ONE" as TeamId;
const TWO = "TWO" as TeamId;

const context = ( overrides: Partial<GameContext> = {} ): GameContext => Context.make( {
	turn: 0,
	players: [ alice, bob ],
	teams: {},
	teamNames: {},
	interactions: [],
	interactionCount: 0,
	...overrides
} );

const config = ( overrides: Partial<BaseGameConfig> = {} ): BaseGameConfig => ( {
	playerCount: 2,
	autoStart: true,
	...overrides
} );

type Counter = { count: number };

const record = ( overrides: Partial<GameRecord<Counter, BaseGameConfig>> = {} ) => ( {
	_tag: "swish/GameRecord" as const,
	id: "game-1",
	version: 0,
	players: {},
	status: "IN_PROGRESS" as const,
	context: context(),
	config: config(),
	state: { count: 0 },
	...overrides
} ) as GameRecord<Counter, BaseGameConfig>;

const runtime = ( overrides: Partial<GameRuntime> = {} ): GameRuntime => ( {
	autoPlay: HashSet.empty<PlayerId>(),
	spectators: {},
	revision: 0,
	...overrides
} ) as GameRuntime;

const frame = ( overrides: Partial<InteractionFrame> = {} ): InteractionFrame => Frame.make( {
	id: "f1",
	kind: "claim",
	initiator: alice,
	responders: [ bob ],
	pending: [ bob ],
	responses: [],
	options: [ InteractionOption.make( { move: "challenge" } ) ],
	resolution: "first",
	allowPass: true,
	secret: false,
	openedAtTurn: 0,
	...overrides
} );

const answered = ( playerId: PlayerId, move: string ) =>
	InteractionResponse.make( { playerId, move, outcome: "answered" } );

const passed = ( playerId: PlayerId ) =>
	InteractionResponse.make( { playerId, outcome: "passed" } );

const BOTH = { botMove: true, botRespond: true };


describe( "swish/utils", () => {

	describe( "replay", () => {

		const apply = ( state: Counter, event: { _tag: "add"; by: number } ) =>
			( { count: state.count + event.by } );

		const commit = ( id: string, by: number ) => ( {
			id,
			at: 0,
			events: [ { _tag: "add" as const, by } ],
			meta: { _tag: "swish/CommitMeta" as const, command: "move" as const, actor: alice }
		} );

		const log = [ commit( "c1", 1 ), commit( "c2", 2 ), commit( "c3", 4 ) ];

		it( "folds the log up to the cursor and no further", () => {
			// Anything past the cursor is the redo tail: still stored, not yet part
			// of the game.
			const folded = replay( record(), { log, cursor: 2, version: 9, apply } as never );
			assert.strictEqual( ( folded.state as Counter ).count, 3 );
		} );

		it( "folds nothing at a cursor of zero", () => {
			const folded = replay( record(), { log, cursor: 0, version: 1, apply } as never );
			assert.strictEqual( ( folded.state as Counter ).count, 0 );
		} );

		it( "stamps the version it was given rather than deriving it", () => {
			// It counts every mutation including the undos, so a client that cached
			// v7 sees a number above it after a take-back.
			const folded = replay( record(), { log, cursor: 1, version: 42, apply } as never );
			assert.strictEqual( folded.version, 42 );
		} );

		it( "clamps a cursor past the end of the log", () => {
			const folded = replay( record(), { log, cursor: 99, version: 1, apply } as never );
			assert.strictEqual( ( folded.state as Counter ).count, 7 );
		} );

		it( "clamps a negative cursor", () => {
			const folded = replay( record(), { log, cursor: -3, version: 1, apply } as never );
			assert.strictEqual( ( folded.state as Counter ).count, 0 );
		} );

		it( "is the same answer however many times it runs", () => {
			const once = replay( record(), { log, cursor: 3, version: 1, apply } as never );
			const twice = replay( record(), { log, cursor: 3, version: 1, apply } as never );
			assert.deepStrictEqual( once, twice );
		} );
	} );

	describe( "nextInOrder", () => {

		const table = context( { players: [ alice, bob, carol ] } );

		it( "goes round the table", () => {
			assert.strictEqual( nextInOrder( table, alice ), bob );
			assert.strictEqual( nextInOrder( table, carol ), alice );
		} );

		it( "hands the turn to the first seat for a player who is not seated", () => {
			assert.strictEqual( nextInOrder( table, dave ), alice );
		} );
	} );

	describe( "the clock stamps", () => {

		it( "counts the first write as a change", () => {
			assert.isTrue( pendingSeatChanged( undefined, record() ) );
		} );

		it( "notices a new current player", () => {
			const before = record( { context: context( { currentPlayer: alice } ) } );
			const after = record( { context: context( { currentPlayer: bob } ) } );

			assert.isTrue( pendingSeatChanged( before, after ) );
			assert.isFalse( pendingSeatChanged( before, before ) );
		} );

		it( "notices a turn going by, and a status changing", () => {
			assert.isTrue( pendingSeatChanged(
				record(),
				record( { context: context( { turn: 1 } ) } )
			) );
			assert.isTrue( pendingSeatChanged( record(), record( { status: "COMPLETED" } ) ) );
		} );

		it( "leaves the stamp alone for a write that moves none of them", () => {
			// `autoPlay` writes without moving the turn, and a stamp that followed it
			// would let a player keep their seat by handing it over and taking it back.
			const before = record();
			assert.isFalse( pendingSeatChanged( before, record() ) );
		} );

		it( "restarts the window clock only for a different window", () => {
			const open = record( { context: context( { interactions: [ frame() ] } ) } );
			const same = record( { context: context( { interactions: [ frame() ] } ) } );
			const other = record( { context: context( { interactions: [ frame( { id: "f2" } ) ] } ) } );

			assert.isFalse( activeFrameChanged( open, same ) );
			assert.isTrue( activeFrameChanged( open, other ) );
			assert.isTrue( activeFrameChanged( undefined, open ) );
			assert.isTrue( activeFrameChanged( open, record() ) );
		} );

		it( "counts a window closing and another opening as a new one", () => {
			// Comparing ids rather than depth is what makes that true.
			const first = record( { context: context( { interactions: [ frame( { id: "f1" } ) ] } ) } );
			const second = record( { context: context( { interactions: [ frame( { id: "f2" } ) ] } ) } );

			assert.isTrue( activeFrameChanged( first, second ) );
		} );

		it( "restarts the turn clock when a responder answers", () => {
			// Each answer restarts the delay, so machine-played responders reply a
			// beat apart rather than all in the same instant.
			const both = record( {
				context: context( { interactions: [ frame( { pending: [ bob, carol ] } ) ] } )
			} );
			const one = record( {
				context: context( { interactions: [ frame( { pending: [ carol ] } ) ] } )
			} );

			assert.isTrue( pendingActorsChanged( both, one ) );
			assert.isFalse( pendingActorsChanged( both, both ) );
		} );

		it( "leaves it alone with no window and nothing moved", () => {
			assert.isFalse( pendingActorsChanged( record(), record() ) );
		} );
	} );

	describe( "isMachinePlayed", () => {

		const withBot = record( {
			players: {
				[ alice ]: { _tag: "swish/PlayerInfo", id: alice, name: "A", avatar: "a", isBot: true },
				[ bob ]: { _tag: "swish/PlayerInfo", id: bob, name: "B", avatar: "b" }
			}
		} as never );

		it( "is true for a seat nobody ever sat in", () => {
			assert.isTrue( isMachinePlayed( withBot, runtime(), alice ) );
		} );

		it( "is false for a person playing their own seat", () => {
			assert.isFalse( isMachinePlayed( withBot, runtime(), bob ) );
		} );

		it( "is true for a seat its player handed over", () => {
			const handed = runtime( { autoPlay: HashSet.make( bob ) } );
			assert.isTrue( isMachinePlayed( withBot, handed, bob ) );
		} );
	} );

	describe( "resolveClock", () => {

		const clocks = config( { botDelayMillis: 100, moveTimeoutMillis: 5_000 } );

		it( "keeps no clock before the game is in progress", () => {
			const waiting = record( { status: "CREATED", config: clocks } );
			assert.deepStrictEqual(
				resolveClock( waiting, runtime( { turnStartedAt: 1_000 } ), BOTH ),
				{ deadline: undefined, interactionDeadline: undefined }
			);
		} );

		it( "keeps no clock before a turn has been stamped", () => {
			const started = record( { config: clocks, context: context( { currentPlayer: alice } ) } );
			assert.isUndefined( resolveClock( started, runtime(), BOTH ).deadline );
		} );

		it( "gives a human seat the move timeout", () => {
			const table = record( { config: clocks, context: context( { currentPlayer: alice } ) } );
			const clock = resolveClock( table, runtime( { turnStartedAt: 1_000 } ), BOTH );

			assert.strictEqual( clock.deadline, 6_000 );
			assert.isUndefined( clock.interactionDeadline );
		} );

		it( "gives a machine-played seat the bot delay instead", () => {
			const table = record( { config: clocks, context: context( { currentPlayer: alice } ) } );
			const handed = runtime( { turnStartedAt: 1_000, autoPlay: HashSet.make( alice ) } );

			assert.strictEqual( resolveClock( table, handed, BOTH ).deadline, 1_100 );
		} );

		it( "keeps no clock at all for a game with no bot policy", () => {
			// A timeout's only outcome is to hand the seat to the very policy that
			// clock governs, so without one it would take the seat away and leave
			// nothing to play it.
			const table = record( { config: clocks, context: context( { currentPlayer: alice } ) } );
			const clock = resolveClock(
				table,
				runtime( { turnStartedAt: 1_000 } ),
				{ botMove: false, botRespond: false }
			);

			assert.isUndefined( clock.deadline );
		} );

		it( "keeps none when the game declares no bot delay", () => {
			const table = record( {
				config: config( { moveTimeoutMillis: 5_000 } ),
				context: context( { currentPlayer: alice } )
			} );

			assert.isUndefined( resolveClock( table, runtime( { turnStartedAt: 1 } ), BOTH ).deadline );
		} );

		it( "counts an open window down from when it opened", () => {
			// Measured from the last thing that happened instead, a table could hold
			// a window open indefinitely by answering it slowly.
			const open = record( {
				config: clocks,
				context: context( {
					currentPlayer: alice,
					interactions: [ frame( { timeoutMillis: 2_000 } ) ]
				} )
			} );

			const clock = resolveClock(
				open,
				runtime( { turnStartedAt: 5_000, interactionStartedAt: 1_000 } ),
				BOTH
			);

			assert.strictEqual( clock.interactionDeadline, 3_000 );
		} );

		it( "wakes on the bot delay while showing the window's own deadline", () => {
			const open = record( {
				config: clocks,
				context: context( {
					currentPlayer: alice,
					interactions: [ frame( { pending: [ bob ], timeoutMillis: 9_000 } ) ]
				} )
			} );

			const handed = runtime( {
				turnStartedAt: 1_000,
				interactionStartedAt: 1_000,
				autoPlay: HashSet.make( bob )
			} );

			const clock = resolveClock( open, handed, BOTH );

			assert.strictEqual( clock.deadline, 1_100, "the engine wakes to take an answer" );
			assert.strictEqual( clock.interactionDeadline, 10_000, "the client counts this down" );
		} );

		it( "keeps no window clock for a window with no timeout", () => {
			const open = record( {
				config: clocks,
				context: context( { currentPlayer: alice, interactions: [ frame() ] } )
			} );

			const clock = resolveClock(
				open,
				runtime( { turnStartedAt: 1_000, interactionStartedAt: 1_000 } ),
				BOTH
			);

			assert.isUndefined( clock.interactionDeadline );
			assert.isUndefined( clock.deadline, "and nothing to wake for" );
		} );

		it( "gives the suspended seat no clock of its own", () => {
			// Handing their seat to the bot for failing to move during somebody
			// else's decision would be a punishment for being interrupted.
			const open = record( {
				config: clocks,
				context: context( { currentPlayer: alice, interactions: [ frame() ] } )
			} );

			const clock = resolveClock(
				open,
				runtime( { turnStartedAt: 1_000, interactionStartedAt: 1_000 } ),
				BOTH
			);

			assert.notStrictEqual( clock.deadline, 6_000 );
		} );
	} );

	describe( "teams", () => {

		const sides = context( {
			players: [ alice, bob, carol, dave ],
			teams: { [ alice ]: ONE, [ bob ]: TWO, [ carol ]: ONE, [ dave ]: TWO },
			teamNames: { [ ONE ]: "Reds" }
		} );

		it( "reads a side's chosen name, and none where it never chose", () => {
			assert.strictEqual( nameOf( sides, ONE ), "Reds" );
			assert.isUndefined( nameOf( sides, TWO ) );
		} );

		it( "sizes a side off the config", () => {
			assert.strictEqual( teamSize( config( { playerCount: 6, teams: [ ONE, TWO ] } ) ), 3 );
		} );

		it( "reads membership both ways", () => {
			assert.strictEqual( teamOf( sides, alice ), ONE );
			assert.deepStrictEqual( membersOf( sides, ONE ), [ alice, carol ] );
		} );

		it( "counts a seat as its own teammate for the purpose of asking", () => {
			// Which is what lets a game catch "asking yourself" with the same rule.
			assert.isTrue( areTeammates( sides, alice, alice ) );
			assert.isTrue( areTeammates( sides, alice, carol ) );
			assert.isFalse( areTeammates( sides, alice, bob ) );
		} );

		it( "lists teammates without the seat itself, and the opposition", () => {
			assert.deepStrictEqual( teamMatesOf( sides, alice ), [ carol ] );
			assert.deepStrictEqual( opponentsOf( sides, alice ), [ bob, dave ] );
		} );
	} );

	describe( "validateTeamConfig", () => {

		it( "accepts a game with no sides at all", () => {
			assert.isUndefined( validateTeamConfig( config() ) );
		} );

		it( "refuses fewer than two sides", () => {
			const invalid = validateTeamConfig( config( { teams: [ ONE ] } ) );
			assert.include( invalid?.reason ?? "", "at least two sides" );
		} );

		it( "refuses duplicate ids", () => {
			const invalid = validateTeamConfig( config( { playerCount: 4, teams: [ ONE, ONE ] } ) );
			assert.include( invalid?.reason ?? "", "must be unique" );
		} );

		it( "refuses seats that do not split evenly", () => {
			const invalid = validateTeamConfig( config( { playerCount: 5, teams: [ ONE, TWO ] } ) );
			assert.include( invalid?.reason ?? "", "do not split evenly" );
		} );

		it( "accepts an even split", () => {
			assert.isUndefined( validateTeamConfig( config( { playerCount: 6, teams: [ ONE, TWO ] } ) ) );
		} );
	} );

	describe( "balanceTeams", () => {

		it( "fills the emptiest side each time", () => {
			const filled = balanceTeams( [ alice, bob, carol, dave ], [ ONE, TWO ], {} );
			const counts = filled.reduce(
				( acc, entry ) => ( { ...acc, [ entry.team ]: ( acc[ entry.team ] ?? 0 ) + 1 } ),
				{} as Record<string, number>
			);

			assert.deepStrictEqual( counts, { ONE: 2, TWO: 2 } );
		} );

		it( "leaves a seat that already picked alone", () => {
			const filled = balanceTeams(
				[ alice, bob, carol, dave ],
				[ ONE, TWO ],
				{ [ alice ]: TWO, [ bob ]: TWO }
			);

			assert.deepStrictEqual( filled.map( entry => entry.playerId ), [ carol, dave ] );
			assert.deepStrictEqual( filled.map( entry => entry.team ), [ ONE, ONE ] );
		} );

		it( "hands out nothing when everybody already picked", () => {
			const filled = balanceTeams(
				[ alice, bob ],
				[ ONE, TWO ],
				{ [ alice ]: ONE, [ bob ]: TWO }
			);

			assert.deepStrictEqual( filled, [] );
		} );
	} );

	describe( "interleaveSeats", () => {

		it( "alternates the sides so plain round-robin passes play across", () => {
			const order = interleaveSeats(
				[ alice, bob, carol, dave ],
				[ ONE, TWO ],
				{ [ alice ]: ONE, [ bob ]: ONE, [ carol ]: TWO, [ dave ]: TWO }
			);

			assert.deepStrictEqual( order, [ alice, carol, bob, dave ] );
		} );

		it( "is always a permutation of the roster", () => {
			const players = [ alice, bob, carol, dave ];
			const order = interleaveSeats( players, [ ONE, TWO ], { [ alice ]: ONE } );

			assert.deepStrictEqual( [ ...order ].sort(), [ ...players ].sort() );
		} );

		it( "keeps a seat with no side at the back rather than dropping it", () => {
			// The seating order is what each player's view is built from, so a
			// missing seat would quietly be served the table's view instead of its own.
			const order = interleaveSeats(
				[ alice, bob, carol ],
				[ ONE, TWO ],
				{ [ alice ]: ONE, [ bob ]: TWO }
			);

			assert.strictEqual( order.at( -1 ), carol );
		} );

		it( "handles uneven sides without losing anyone", () => {
			const order = interleaveSeats(
				[ alice, bob, carol ],
				[ ONE, TWO ],
				{ [ alice ]: ONE, [ bob ]: ONE, [ carol ]: TWO }
			);

			assert.deepStrictEqual( [ ...order ].sort(), [ alice, bob, carol ].sort() );
		} );
	} );

	describe( "compileStandings", () => {

		const ranking = ( entries: ReadonlyArray<[ PlayerId, number, number? ]> ) =>
			entries.map( ( [ playerId, rank, score ] ) => ( {
				_tag: "swish/PlayerStanding" as const,
				playerId,
				rank,
				...( score === undefined ? {} : { score } )
			} ) );

		const standingsOf = ( parts: Omit<Standings, "_tag"> ): Standings =>
			( { _tag: "swish/Standings", ...parts } );

		const sides = context( {
			players: [ alice, bob, carol, dave ],
			teams: { [ alice ]: ONE, [ bob ]: TWO, [ carol ]: ONE, [ dave ]: TWO }
		} );

		it( "leaves a game with no sides exactly as it found it", () => {
			const standings = standingsOf( { ranking: ranking( [ [ alice, 1 ], [ bob, 2 ] ] ) } );
			assert.deepStrictEqual( compileStandings( standings, context() ), standings );
		} );

		it( "stamps each standing with the side its player was on", () => {
			const standings = standingsOf( {
				ranking: ranking( [ [ alice, 1, 5 ], [ bob, 2, 3 ], [ carol, 3, 1 ], [ dave, 4, 0 ] ] )
			} );

			const compiled = compileStandings( standings, sides );
			assert.deepStrictEqual(
				compiled.ranking.map( entry => entry.team ),
				[ ONE, TWO, ONE, TWO ]
			);
		} );

		it( "places the sides on total score where the game scores", () => {
			const standings = standingsOf( {
				ranking: ranking( [ [ alice, 1, 5 ], [ bob, 2, 3 ], [ carol, 3, 1 ], [ dave, 4, 4 ] ] )
			} );

			const compiled = compileStandings( standings, sides );

			// ONE has 6, TWO has 7.
			assert.deepStrictEqual(
				compiled.teamRanking?.map( entry => [ entry.team, entry.rank, entry.score ] ),
				[ [ TWO, 1, 7 ], [ ONE, 2, 6 ] ]
			);
			assert.strictEqual( compiled.winningTeam, TWO );
		} );

		it( "places them on each side's best rank where it does not", () => {
			const standings = standingsOf( {
				ranking: ranking( [ [ bob, 1 ], [ alice, 2 ], [ dave, 3 ], [ carol, 4 ] ] )
			} );

			const compiled = compileStandings( standings, sides );

			assert.deepStrictEqual(
				compiled.teamRanking?.map( entry => [ entry.team, entry.rank ] ),
				[ [ TWO, 1 ], [ ONE, 2 ] ]
			);
			assert.isUndefined( compiled.teamRanking?.[ 0 ]?.score, "no score to report" );
		} );

		it( "lets sides level on the key share a rank", () => {
			const standings = standingsOf( {
				ranking: ranking( [ [ alice, 1, 5 ], [ bob, 1, 5 ], [ carol, 3, 0 ], [ dave, 3, 0 ] ] )
			} );

			const compiled = compileStandings( standings, sides );
			assert.deepStrictEqual( compiled.teamRanking?.map( entry => entry.rank ), [ 1, 1 ] );
		} );

		it( "leaves a game that compiled its own sides alone", () => {
			const standings = standingsOf( {
				ranking: ranking( [ [ alice, 1, 5 ] ] ),
				teamRanking: [ { _tag: "swish/TeamStanding" as const, team: ONE, rank: 1 } ],
				winningTeam: ONE
			} );

			const compiled = compileStandings( standings, sides );
			assert.deepStrictEqual( compiled.teamRanking, standings.teamRanking );
			assert.strictEqual( compiled.winningTeam, ONE );
		} );

		it( "falls back to best rank when only some standings are scored", () => {
			const standings = standingsOf( {
				ranking: ranking( [ [ alice, 1, 5 ], [ bob, 2 ], [ carol, 3 ], [ dave, 4 ] ] )
			} );

			const compiled = compileStandings( standings, sides );
			assert.isUndefined( compiled.teamRanking?.[ 0 ]?.score );
			assert.strictEqual( compiled.winningTeam, ONE );
		} );
	} );

	describe( "reading a window", () => {

		it( "takes the innermost window off the stack", () => {
			// A window opened while another is open is a question about that
			// question, and has to be settled before the one underneath it can be.
			const stacked = context( {
				interactions: [ frame( { id: "outer" } ), frame( { id: "inner" } ) ]
			} );

			assert.strictEqual( activeFrame( stacked )?.id, "inner" );
			assert.isUndefined( activeFrame( context() ) );
		} );

		it( "finds a window by id anywhere on the stack", () => {
			const stacked = context( {
				interactions: [ frame( { id: "outer" } ), frame( { id: "inner" } ) ]
			} );

			assert.strictEqual( frameById( stacked, "outer" )?.id, "outer" );
			assert.isUndefined( frameById( stacked, "missing" ) );
		} );

		it( "calls a window settled once nobody is left to answer", () => {
			assert.isFalse( isSettled( frame() ) );
			assert.isTrue( isSettled( frame( { pending: [] } ) ) );
		} );

		it( "offers every unnamed option to every responder", () => {
			const open = frame( {
				pending: [ bob, carol ],
				options: [
					InteractionOption.make( { move: "challenge" } ),
					InteractionOption.make( { move: "block", players: [ carol ] } )
				]
			} );

			assert.deepStrictEqual( optionsFor( open, bob ), [ "challenge" ] );
			assert.deepStrictEqual( optionsFor( open, carol ), [ "challenge", "block" ] );
		} );

		it( "offers nothing to somebody the window is not waiting on", () => {
			// Answering twice is not one of the things a window allows.
			const open = frame( { responders: [ bob, carol ], pending: [ carol ] } );
			assert.deepStrictEqual( optionsFor( open, bob ), [] );
			assert.isFalse( canRespond( open, bob, "challenge" ) );
			assert.isTrue( canRespond( open, carol, "challenge" ) );
		} );

		it( "reads one responder's answer back", () => {
			const open = frame( { responses: [ answered( bob, "challenge" ) ] } );
			assert.strictEqual( responseOf( open, bob )?.move, "challenge" );
			assert.isUndefined( responseOf( open, carol ) );
		} );

		it( "leaves passes and timeouts out of the answers", () => {
			// An empty list means nobody objected, which is usually where the
			// guarded action actually happens.
			const open = frame( {
				responses: [ passed( bob ), answered( carol, "challenge" ) ]
			} );

			assert.deepStrictEqual( answersOf( open ).map( a => a.playerId ), [ carol ] );
			assert.strictEqual( firstAnswer( open )?.playerId, carol );
			assert.isUndefined( firstAnswer( frame( { responses: [ passed( bob ) ] } ) ) );
		} );
	} );

	describe( "redactInteractions", () => {

		const secret = frame( {
			secret: true,
			responders: [ bob, carol ],
			pending: [],
			responses: [ answered( bob, "vote" ), answered( carol, "vote" ) ]
		} );

		it( "leaves a context with no secret window untouched", () => {
			const plain = context( { interactions: [ frame() ] } );
			assert.strictEqual( redactInteractions( plain, TableAudience.make( {} ) ), plain );
		} );

		it( "hides everyone else's answer from a responder", () => {
			const redacted = redactInteractions(
				context( { interactions: [ secret ] } ),
				PlayerAudience.make( { playerId: bob } )
			);

			const responses = redacted.interactions[ 0 ]!.responses;
			assert.strictEqual( responses.find( r => r.playerId === bob )?.move, "vote" );
			assert.isUndefined( responses.find( r => r.playerId === carol )?.move );
		} );

		it( "hides every answer from the table", () => {
			const redacted = redactInteractions(
				context( { interactions: [ secret ] } ),
				TableAudience.make( {} )
			);

			for ( const response of redacted.interactions[ 0 ]!.responses ) {
				assert.isUndefined( response.move );
			}
		} );

		it( "still says who has answered", () => {
			// `pending` is left alone, so a client can show who is being waited on.
			const open = frame( { ...secret, pending: [ carol ] } );
			const redacted = redactInteractions(
				context( { interactions: [ open ] } ),
				TableAudience.make( {} )
			);

			assert.deepStrictEqual( [ ...redacted.interactions[ 0 ]!.pending ], [ carol ] );
			assert.strictEqual( redacted.interactions[ 0 ]!.responses.length, 2 );
		} );

		it( "leaves a public window on the same stack alone", () => {
			const stacked = context( {
				interactions: [
					frame( { id: "public", responses: [ answered( bob, "challenge" ) ] } ),
					secret
				]
			} );

			const redacted = redactInteractions( stacked, TableAudience.make( {} ) );
			assert.strictEqual( redacted.interactions[ 0 ]!.responses[ 0 ]?.move, "challenge" );
		} );
	} );

	describe( "makeRng", () => {

		it( "gives the same stream for the same parts", () => {
			const a = makeRng( "game", 3, "deal" );
			const b = makeRng( "game", 3, "deal" );

			assert.strictEqual( a.next(), b.next() );
			assert.strictEqual( a.int( 100 ), b.int( 100 ) );
		} );

		it( "gives a different stream for a different salt", () => {
			// Distinct part tuples give distinct streams, which is how the engine
			// keeps same-turn deciders from colliding.
			const deal = makeRng( "game", 3, "deal" );
			const order = makeRng( "game", 3, "order" );

			assert.notStrictEqual( deal.next(), order.next() );
		} );

		it( "gives a different stream per cursor", () => {
			assert.notStrictEqual(
				makeRng( "game", 1, "" ).next(),
				makeRng( "game", 2, "" ).next()
			);
		} );

		it( "shuffles reproducibly, and does not mutate its input", () => {
			const cards = [ 1, 2, 3, 4, 5, 6, 7, 8 ];

			const once = makeRng( "seed" ).shuffle( cards );
			const twice = makeRng( "seed" ).shuffle( cards );

			assert.deepStrictEqual( once, twice );
			assert.deepStrictEqual( cards, [ 1, 2, 3, 4, 5, 6, 7, 8 ] );
			assert.deepStrictEqual( [ ...once ].sort(), cards );
		} );

		it( "keeps `int` inside its bound", () => {
			const rng = makeRng( "bounds" );
			for ( let i = 0; i < 200; i++ ) {
				const value = rng.int( 5 );
				assert.isAtLeast( value, 0 );
				assert.isBelow( value, 5 );
			}
		} );
	} );
} );
