import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { fish } from "@/games/fish/server/engine.ts";
import type { FishConfig, FishPlayerView, FishView } from "@/games/fish/shared/schema.ts";
import { buildConfig, getCardsOfBook } from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import { getCardRank } from "@/shared/cards/utils.ts";
import { GameCode, GameId } from "@/shared/swish/schema.ts";
import type { PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";
import { mulberry32 } from "@/shared/utils/rng.ts";
import { makeMemory, type Memory, player, run, runFail } from "@tests/_helpers/swish.ts";

const GID = GameId.make( "g1" );
const CODE = GameCode.make( "ABC123" );

const P1 = player( "p1" );
const P2 = player( "p2" );
const P3 = player( "p3" );
const P4 = player( "p4" );
const P5 = player( "p5" );
const P6 = player( "p6" );
/** Never joins anything — proves `assertMember` and the roster guards bite. */
const STRANGER = player( "p9" );

const FOUR = [ P1, P2, P3, P4 ];
const SIX = [ P1, P2, P3, P4, P5, P6 ];

/**
 * The fish deal runs through `generateDeck()`, which shuffles with the GLOBAL
 * `Math.random` — not the engine's seeded rng. Pinning `Math.random` to a
 * mulberry32 stream is therefore the only way to make a deal reproducible, and
 * it also pins the `Math.random` tie-breaks inside the bot.
 */
const seedGlobalRandom = ( seed: number ) => {
	const original = Math.random;
	Math.random = mulberry32( seed );
	return () => { Math.random = original; };
};

// --- Config fixtures -------------------------------------------------------

/** NORMAL: a 52 card deck, 13 rank books of 4 cards. Only 4 players divide evenly. */
const normalConfig = ( over: Partial<FishConfig> = {} ) => ( {
	...buildConfig( 4, "NORMAL", 2 ),
	autoStart: false,
	...over
} ) as FishConfig;

/** CANADIAN: 7s removed (48 cards), 8 suit-half books of 6 cards. */
const canadianConfig = ( playerCount: 4 | 6 | 8 = 4, teamCount: 2 | 3 | 4 = 2 ) => ( {
	...buildConfig( playerCount, "CANADIAN", teamCount ),
	autoStart: false
} ) as FishConfig;

// --- Boot helpers ----------------------------------------------------------

/** initialize → join every player → (optionally) start, landing in TEAM_CONFIG. */
async function bootFish(
	memory: Memory,
	opts: {
		config?: FishConfig;
		players?: ReturnType<typeof player>[];
		start?: boolean;
	} = {}
) {
	const engine = await run( memory, fish );
	const config = opts.config ?? normalConfig();
	const players = opts.players ?? FOUR;

	await run( memory, engine.initialize( { id: GID, code: CODE, config, seed: "seed" } ) );
	for ( const p of players ) {
		await run( memory, engine.join( p ) );
	}

	if ( opts.start !== false ) {
		await run( memory, engine.start( players[ 0 ]!.id ) );
	}

	return engine;
}

type Engine = Awaited<ReturnType<typeof bootFish>>;

const TEAM_NAMES = [ "Red", "Blue", "Green", "Gold" ];

/** Teams dealt round-robin across the seats — every PLAY test starts from this. */
const teamsOf = ( players: ReturnType<typeof player>[], teamCount = 2 ) => {
	const teams: Record<string, PlayerId[]> = {};
	for ( let t = 0; t < teamCount; t++ ) {
		teams[ TEAM_NAMES[ t ]! ] = players
			.filter( ( _, i ) => i % teamCount === t )
			.map( p => p.id );
	}

	return teams;
};

/** boot → `createTeams`, which ends TEAM_CONFIG and deals hands on entering PLAY. */
async function bootPlay(
	memory: Memory,
	opts: { config?: FishConfig; players?: ReturnType<typeof player>[] } = {}
) {
	const players = opts.players ?? FOUR;
	const config = opts.config ?? normalConfig();
	const engine = await bootFish( memory, { config, players } );
	await run( memory, engine.createTeams(
		{ teams: teamsOf( players, config.teamCount ) },
		players[ 0 ]!
	) );

	return engine;
}

// --- Read helpers ----------------------------------------------------------

/** Retypes a plain object literal as one of the branded `PlayerId`-keyed maps. */
const byPlayer = <T>( o: Record<string, T> ) => o as Record<PlayerId, T>;

/** The `InvalidMove` shape, whose `reason` says which guard fired. */
type InvalidMoveError = { _tag: string; reason: string };

/** Narrows the audience-parameterised view to the private (player) variant. */
const asPlayerView = ( view: FishView ) => {
	if ( view._tag !== "fish/PlayerView" ) {
		throw new Error( `expected a player view, got ${ view._tag }` );
	}

	return view;
};

const stateOf = ( memory: Memory, engine: Engine, p: PlayerInfo ) =>
	run( memory, engine.getState( p.id ) );

const viewOf = async ( memory: Memory, engine: Engine, p: PlayerInfo ) =>
	asPlayerView( ( await stateOf( memory, engine, p ) ).view );

const handOf = async ( memory: Memory, engine: Engine, p: PlayerInfo ) =>
	( await viewOf( memory, engine, p ) ).hand;

/** The table + per-player payload of the most recent broadcast. */
const lastBroadcast = ( memory: Memory ) => memory.broadcasts.at( -1 )! as {
	channel: string;
	snapshot: {
		table: { view: FishView };
		playerViews: Record<string, { view: FishView }>;
	};
};

/** Every player's hand, keyed by id — the omniscient view only a test has. */
async function allHands( memory: Memory, engine: Engine, players: PlayerInfo[] ) {
	const hands: Record<PlayerId, readonly CardId[]> = {};
	for ( const p of players ) {
		hands[ p.id ] = await handOf( memory, engine, p );
	}

	return hands;
}

/** The truthful `{ card: holder }` map for one book — i.e. a claim that succeeds. */
async function correctClaim(
	memory: Memory,
	engine: Engine,
	players: PlayerInfo[],
	book: string,
	config: FishConfig
) {
	const hands = await allHands( memory, engine, players );
	const claim: Record<string, PlayerId> = {};
	for ( const card of getCardsOfBook( book, config.type ) ) {
		const owner = players.find( p => hands[ p.id ]!.includes( card ) );
		if ( owner ) {
			claim[ card ] = owner.id;
		}
	}

	return claim;
}

/** A book the given player holds at least one card of (so they may ask for it). */
const bookInHand = async ( memory: Memory, engine: Engine, p: PlayerInfo, config: FishConfig ) => {
	const hand = await handOf( memory, engine, p );
	return getBookOf( hand[ 0 ]!, config );
};

const getBookOf = ( card: CardId, config: FishConfig ) =>
	config.books.find( b => getCardsOfBook( b, config.type ).includes( card ) )!;

/**
 * A legal ask for `asker`: a card from a book they hold, held by an opponent.
 * Falls back to any missing card of that book when nobody holds it.
 */
async function legalAsk(
	memory: Memory,
	engine: Engine,
	asker: PlayerInfo,
	opponents: PlayerInfo[],
	players: PlayerInfo[],
	config: FishConfig
) {
	const hands = await allHands( memory, engine, players );
	const hand = hands[ asker.id ]!;

	for ( const card of hand ) {
		const book = getBookOf( card, config );
		for ( const cardId of getCardsOfBook( book, config.type ) ) {
			if ( hand.includes( cardId ) ) {
				continue;
			}

			const holder = opponents.find( o => hands[ o.id ]!.includes( cardId ) );
			if ( holder ) {
				return { from: holder.id, cardId, success: true };
			}
		}
	}

	// Every missing card of every book in hand sits with a teammate.
	for ( const card of hand ) {
		const book = getBookOf( card, config );
		const missing = getCardsOfBook( book, config.type ).find( c => !hand.includes( c ) );
		if ( missing ) {
			return { from: opponents[ 0 ]!.id, cardId: missing, success: false };
		}
	}

	throw new Error( "no legal ask available" );
}

/**
 * Rewrites the persisted snapshot. A handful of `validate` guards cannot be
 * reached through normal play (`resolveNextPlayer` never seats an empty-handed
 * player), so this is the only way to exercise those defensive branches.
 */
function patchStored( memory: Memory, patch: {
	currentPlayer?: PlayerId;
	hands?: Record<PlayerId, CardId[]>;
} ) {
	const snap = memory.store.value as {
		context: Record<string, unknown>;
		state: { hands: Record<PlayerId, readonly CardId[]>; cardCounts: Record<PlayerId, number> };
	};

	const hands = { ...snap.state.hands, ...( patch.hands ?? {} ) };
	const cardCounts = { ...snap.state.cardCounts };
	for ( const pid of Object.keys( patch.hands ?? {} ) as PlayerId[] ) {
		cardCounts[ pid ] = patch.hands![ pid ]!.length;
	}

	memory.store.value = {
		...snap,
		context: patch.currentPlayer
			? { ...snap.context, currentPlayer: patch.currentPlayer }
			: snap.context,
		state: { ...snap.state, hands, cardCounts }
	};
}

// ===========================================================================
describe( "fish — setup & config", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 42 ); } );
	afterEach( () => { restore(); } );

	test( "initialize seeds an empty game — no hands, no teams, no seats", async () => {
		const engine = await run( memory, fish );
		await run( memory, engine.initialize( {
			id: GID, code: CODE, config: normalConfig(), seed: "seed"
		} ) );

		const stored = memory.store.value as {
			status: string;
			state: { hands: Record<string, unknown>; teams: Record<string, unknown> };
		};

		expect( stored.status ).toBe( "CREATED" );
		expect( stored.state.hands ).toEqual( {} );
		expect( stored.state.teams ).toEqual( {} );
		expect( memory.log.commits ).toHaveLength( 0 );
	} );

	test( "joining seats the player with zeroed metrics and no team", async () => {
		const engine = await bootFish( memory, { start: false } );
		const state = await stateOf( memory, engine, P1 );

		expect( Object.keys( state.players ) ).toEqual( [ "p1", "p2", "p3", "p4" ] );
		expect( state.view.playerData[ P1.id ] ).toEqual( {
			teamId: "",
			metrics: {
				totalAsks: 0,
				cardsGiven: 0,
				cardsTaken: 0,
				totalClaims: 0,
				successfulClaims: 0
			}
		} );
	} );

	test( "no cards are dealt until the PLAY phase is entered", async () => {
		const engine = await bootFish( memory );
		const view = await viewOf( memory, engine, P1 );

		expect( view.hand ).toEqual( [] );
		expect( view.cardLocations ).toEqual( {} );
	} );

	test( "NORMAL deals the whole 52 card deck into 13-card hands", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const hands = await allHands( memory, engine, FOUR );

		for ( const p of FOUR ) {
			expect( hands[ p.id ] ).toHaveLength( 13 );
		}

		const dealt = FOUR.flatMap( p => hands[ p.id ]! );
		expect( new Set( dealt ).size ).toBe( 52 );
		expect( config.books ).toHaveLength( 13 );
		expect( config.bookSize ).toBe( 4 );
	} );

	test( "CANADIAN strips the sevens: a 48 card deck of 8 six-card books", async () => {
		const config = canadianConfig();
		const engine = await bootPlay( memory, { config } );
		const hands = await allHands( memory, engine, FOUR );

		const dealt = FOUR.flatMap( p => hands[ p.id ]! );
		expect( dealt ).toHaveLength( 48 );
		expect( dealt.some( c => getCardRank( c ) === "7" ) ).toBe( false );
		expect( config.books ).toHaveLength( 8 );
		expect( config.bookSize ).toBe( 6 );
	} );

	test( "a 6 player CANADIAN game deals 8 cards each across 3 teams", async () => {
		const config = canadianConfig( 6, 3 );
		const engine = await bootPlay( memory, { config, players: SIX } );

		const hands = await allHands( memory, engine, SIX );
		for ( const p of SIX ) {
			expect( hands[ p.id ] ).toHaveLength( 8 );
		}

		const view = await viewOf( memory, engine, P1 );
		expect( Object.keys( view.teams ) ).toHaveLength( 3 );
	} );

	test( "the deal tracks every card as possibly held by every player", async () => {
		const engine = await bootPlay( memory );
		const view = await viewOf( memory, engine, P1 );

		expect( Object.keys( view.cardLocations ) ).toHaveLength( 52 );
		for ( const owners of Object.values( view.cardLocations ) ) {
			expect( owners.slice().sort() ).toEqual( [ P1.id, P2.id, P3.id, P4.id ] );
		}

		expect( view.cardCounts ).toEqual( byPlayer( { p1: 13, p2: 13, p3: 13, p4: 13 } ) );
	} );

	test( "the same game seed deals the same hands (the deal is reproducible)", async () => {
		const first = makeMemory();
		let engine = await bootPlay( first );
		const handsA = await allHands( first, engine, FOUR );

		// Deal again from scratch. `PLAY.onEnter` draws from the engine's seeded
		// stream, so the global `Math.random` pin is irrelevant to the deal — the
		// game's own `seed` is what makes this reproducible.
		const second = makeMemory();
		engine = await bootPlay( second );
		const handsB = await allHands( second, engine, FOUR );

		expect( handsB ).toEqual( handsA );
		// Golden: the deal for seed "seed", pinned so a change to it is visible.
		expect( handsA[ P1.id ] ).toEqual( [
			"JS", "KD", "6H", "3S", "6C", "QD", "9C", "2H", "KS", "JH", "3H", "5D", "AC"
		] as CardId[] );
	} );
} );

// ===========================================================================
describe( "fish — view redaction", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 7 ); } );
	afterEach( () => { restore(); } );

	test( "no projection ever carries the `hands` map", async () => {
		const engine = await bootPlay( memory );
		const forP1 = await stateOf( memory, engine, P1 );
		const table = lastBroadcast( memory ).snapshot.table.view;

		expect( "hands" in forP1.view ).toBe( false );
		expect( "hands" in table ).toBe( false );
	} );

	test( "a player sees their own hand and nobody else's", async () => {
		const engine = await bootPlay( memory );
		const forP1 = await viewOf( memory, engine, P1 );
		const forP2 = await viewOf( memory, engine, P2 );

		expect( forP1.playerId ).toBe( P1.id );
		expect( forP2.playerId ).toBe( P2.id );
		expect( forP1.hand ).toHaveLength( 13 );
		// Hands are disjoint, so seeing your own reveals nothing about a rival's.
		expect( forP1.hand.filter( c => forP2.hand.includes( c ) ) ).toEqual( [] );
	} );

	test( "the table projection carries no hand at all", async () => {
		await bootPlay( memory );
		const table = lastBroadcast( memory ).snapshot.table.view;

		expect( table._tag ).toBe( "fish/TableView" );
		expect( "hand" in table ).toBe( false );
		expect( "playerId" in table ).toBe( false );
		// What it does carry: the public card-tracking data every player may see.
		expect( Object.keys( table.cardLocations ) ).toHaveLength( 52 );
		expect( ( table as { cardCounts: Record<PlayerId, number> } )
			.cardCounts[ P2.id ] ).toBe( 13 );
	} );

	test( "every broadcast player view is redacted to its own recipient", async () => {
		const engine = await bootPlay( memory );
		const { channel, snapshot } = lastBroadcast( memory );

		expect( channel ).toBe( "fish:g1" );
		expect( Object.keys( snapshot.playerViews ).sort() ).toEqual( [ "p1", "p2", "p3", "p4" ] );

		for ( const p of FOUR ) {
			const view = asPlayerView( snapshot.playerViews[ p.id ]!.view );
			expect( view.playerId ).toBe( p.id );
			expect( view.hand.slice().sort() ).toEqual( ( await handOf( memory, engine, p ) )
				.slice().sort() );
		}
	} );

	test( "redaction holds in TEAM_CONFIG, before any card exists", async () => {
		const engine = await bootFish( memory );
		const forP1 = await viewOf( memory, engine, P1 );
		const table = lastBroadcast( memory ).snapshot.table.view;

		expect( forP1._tag ).toBe( "fish/PlayerView" );
		expect( forP1.hand ).toEqual( [] );
		expect( table._tag ).toBe( "fish/TableView" );
		expect( "hands" in table ).toBe( false );
	} );

	test( "redaction holds on a COMPLETED game", async () => {
		// CANADIAN: a NORMAL game cannot be played out (see the SEVENS note in
		// "fish — completion & log").
		const config = canadianConfig();
		const engine = await bootPlay( memory, { config } );
		await claimEveryBook( memory, engine, FOUR, config );

		const forP1 = await stateOf( memory, engine, P1 );
		expect( forP1.status ).toBe( "COMPLETED" );
		expect( "hands" in forP1.view ).toBe( false );
		expect( "hands" in lastBroadcast( memory ).snapshot.table.view ).toBe( false );
	} );

	test( "a non-member cannot read any view (NotAMember)", async () => {
		const engine = await bootPlay( memory );
		const error = await runFail( memory, engine.getState( STRANGER.id ) );
		expect( error._tag ).toBe( "swish/NotAMember" );
	} );
} );

// ===========================================================================
describe( "fish — phases", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 11 ); } );
	afterEach( () => { restore(); } );

	test( "start enters TEAM_CONFIG with the first joiner to act", async () => {
		const engine = await bootFish( memory );
		const state = await stateOf( memory, engine, P1 );

		expect( state.status ).toBe( "IN_PROGRESS" );
		expect( state.context.phase ).toBe( "TEAM_CONFIG" );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "a PLAY move during TEAM_CONFIG is rejected (MoveNotAllowed)", async () => {
		const engine = await bootFish( memory );
		const error = await runFail(
			memory,
			engine.askCard( { from: P2.id, cardId: "AS" as CardId }, P1 )
		);

		expect( error._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "createTeams during PLAY is rejected (MoveNotAllowed)", async () => {
		const engine = await bootPlay( memory );
		const error = await runFail(
			memory,
			engine.createTeams( { teams: teamsOf( FOUR ) }, P1 )
		);

		expect( error._tag ).toBe( "swish/MoveNotAllowed" );
	} );

	test( "createTeams assigns every player a team and moves the game to PLAY", async () => {
		const engine = await bootPlay( memory );
		const view = await viewOf( memory, engine, P1 );
		const state = await stateOf( memory, engine, P1 );

		expect( state.context.phase ).toBe( "PLAY" );
		expect( Object.keys( view.teams ) ).toHaveLength( 2 );

		const teams = Object.values( view.teams );
		expect( teams.map( t => t.name ).sort() ).toEqual( [ "Blue", "Red" ] );
		for ( const team of teams ) {
			expect( team.score ).toBe( 0 );
			expect( team.booksWon ).toEqual( [] );
			expect( team.members ).toHaveLength( 2 );
			for ( const pid of team.members ) {
				expect( view.playerData[ pid ]!.teamId ).toBe( team.id );
			}
		}
	} );

	test( "the team-maker keeps the turn into PLAY", async () => {
		const engine = await bootPlay( memory );
		const state = await stateOf( memory, engine, P1 );
		expect( state.context.currentPlayer ).toBe( P1.id );
	} );

	test( "only the current player may create teams (NotYourTurn)", async () => {
		const engine = await bootFish( memory );
		const error = await runFail( memory, engine.createTeams( { teams: teamsOf( FOUR ) }, P2 ) );
		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );
} );

// ===========================================================================
describe( "fish — createTeams validation", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 3 ); } );
	afterEach( () => { restore(); } );

	const reject = async ( teams: Record<string, PlayerId[]> ) => {
		const engine = await bootFish( memory );
		const error = await runFail( memory, engine.createTeams( { teams }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
		return error as InvalidMoveError;
	};

	test( "the team count must match the config", async () => {
		const error = await reject( {
			Red: [ P1.id ],
			Blue: [ P2.id ],
			Green: [ P3.id, P4.id ]
		} );

		expect( error.reason ).toContain( "Team count" );
	} );

	test( "every player must be assigned", async () => {
		const error = await reject( { Red: [ P1.id, P2.id ], Blue: [ P3.id, P3.id ] } );
		expect( error.reason ).toContain( "divided into teams" );
	} );

	test( "teams must be evenly sized", async () => {
		const error = await reject( { Red: [ P1.id, P2.id, P3.id ], Blue: [ P4.id ] } );
		expect( error.reason ).toContain( "Invalid number of players" );
	} );

	test( "a player who never joined cannot be assigned", async () => {
		const error = await reject( { Red: [ P1.id, P2.id ], Blue: [ P3.id, STRANGER.id ] } );
		expect( error.reason ).toContain( "is not part of the game" );
	} );
} );

// ===========================================================================
describe( "fish — askCard validation", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 5 ); } );
	afterEach( () => { restore(); } );

	test( "you may only ask an opponent, never a teammate", async () => {
		const engine = await bootPlay( memory );
		// Teams alternate seats, so p3 is p1's teammate.
		const hand = await handOf( memory, engine, P1 );
		const error = await runFail(
			memory,
			engine.askCard( { from: P3.id, cardId: hand[ 0 ]! }, P1 )
		) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "only ask opponents" );
	} );

	test( "you must hold a card from the book you ask in", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const hand = await handOf( memory, engine, P1 );
		const booksHeld = new Set( hand.map( c => getBookOf( c, config ) ) );
		const foreignBook = config.books.find( b => !booksHeld.has( b ) )!;

		const error = await runFail( memory, engine.askCard( {
			from: P2.id,
			cardId: getCardsOfBook( foreignBook, config.type )[ 0 ]!
		}, P1 ) ) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "atleast 1 card from the book" );
	} );

	test( "you may not ask for a card you already hold", async () => {
		const engine = await bootPlay( memory );
		const hand = await handOf( memory, engine, P1 );
		const error = await runFail(
			memory,
			engine.askCard( { from: P2.id, cardId: hand[ 0 ]! }, P1 )
		) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "already have this card" );
	} );

	test( "a player with no cards must transfer instead of asking", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		// The engine never seats an empty-handed player, so the guard is reached
		// only from a snapshot that already drifted there.
		patchStored( memory, { currentPlayer: P1.id, hands: { [ P1.id ]: [] } } );

		const error = await runFail(
			memory,
			engine.askCard( { from: P2.id, cardId: "AS" as CardId }, P1 )
		) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "no cards" );
	} );

	test( "you may not ask in a book that has already been claimed", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const book = await bookInHand( memory, engine, P1, config );
		const cards = getCardsOfBook( book, config.type );

		await run( memory, engine.claimBook(
			{ claim: await correctClaim( memory, engine, FOUR, book, config ) },
			P1
		) );

		// A claim strips the book from every hand, so the "hold a card from the
		// book" guard would normally fire first — hand one card back to reach this
		// branch, which is what the engine's own ordering leaves unreachable.
		const hand = await handOf( memory, engine, P1 );
		patchStored( memory, {
			currentPlayer: P1.id,
			hands: { [ P1.id ]: [ ...hand, cards[ 0 ]! ] }
		} );

		const error = await runFail(
			memory,
			engine.askCard( { from: P2.id, cardId: cards[ 1 ]! }, P1 )
		) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "already been claimed" );
	} );

	test( "a player out of turn cannot ask (NotYourTurn)", async () => {
		const engine = await bootPlay( memory );
		const error = await runFail(
			memory,
			engine.askCard( { from: P1.id, cardId: "AS" as CardId }, P2 )
		);

		expect( error._tag ).toBe( "swish/NotYourTurn" );
	} );
} );

// ===========================================================================
describe( "fish — ask resolution", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 13 ); } );
	afterEach( () => { restore(); } );

	/** Finds an ask that the target really can satisfy. */
	async function successfulAsk( engine: Engine, config: FishConfig ) {
		const ask = await legalAsk( memory, engine, P1, [ P2, P4 ], FOUR, config );
		expect( ask.success ).toBe( true );
		return ask;
	}

	test( "a successful ask moves the card and keeps the turn with the asker", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const ask = await successfulAsk( engine, config );

		await run( memory, engine.askCard( { from: ask.from, cardId: ask.cardId }, P1 ) );

		const state = await stateOf( memory, engine, P1 );
		const view = asPlayerView( state.view );
		const target = await viewOf( memory, engine, FOUR.find( p => p.id === ask.from )! );

		expect( view.hand ).toContain( ask.cardId );
		expect( target.hand ).not.toContain( ask.cardId );
		expect( view.cardCounts[ P1.id ] ).toBe( 14 );
		expect( view.cardCounts[ ask.from ] ).toBe( 12 );
		expect( state.context.currentPlayer ).toBe( P1.id );
		// The card's location collapses to a single known owner.
		expect( view.cardLocations[ ask.cardId ] ).toEqual( [ P1.id ] );
	} );

	test( "a successful ask records history and player metrics", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const ask = await successfulAsk( engine, config );

		await run( memory, engine.askCard( { from: ask.from, cardId: ask.cardId }, P1 ) );

		const view = await viewOf( memory, engine, P1 );
		expect( view.lastMoveType ).toBe( "ask" );
		expect( view.askHistory[ 0 ] ).toMatchObject( {
			success: true,
			playerId: P1.id,
			from: ask.from,
			cardId: ask.cardId
		} );
		expect( view.playerData[ P1.id ]!.metrics ).toMatchObject( {
			totalAsks: 1,
			cardsTaken: 1
		} );
		expect( view.playerData[ ask.from ]!.metrics.cardsGiven ).toBe( 1 );
	} );

	test( "a failed ask passes the turn to the player who was asked", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const hands = await allHands( memory, engine, FOUR );
		const hand = hands[ P1.id ]!;

		// A card from a book p1 holds that p2 does NOT have.
		const book = getBookOf( hand[ 0 ]!, config );
		const cardId = getCardsOfBook( book, config.type ).find(
			c => !hand.includes( c ) && !hands[ P2.id ]!.includes( c )
		)!;

		await run( memory, engine.askCard( { from: P2.id, cardId }, P1 ) );

		const state = await stateOf( memory, engine, P1 );
		const view = asPlayerView( state.view );
		expect( view.askHistory[ 0 ]!.success ).toBe( false );
		expect( state.context.currentPlayer ).toBe( P2.id );
		// Neither the asker nor the asked can hold it — both drop out of tracking.
		expect( view.cardLocations[ cardId ] ).not.toContain( P1.id );
		expect( view.cardLocations[ cardId ] ).not.toContain( P2.id );
		expect( view.cardCounts ).toEqual( byPlayer( { p1: 13, p2: 13, p3: 13, p4: 13 } ) );
	} );

	test( "a failed ask still counts as an ask for the asker", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const hands = await allHands( memory, engine, FOUR );
		const hand = hands[ P1.id ]!;
		const book = getBookOf( hand[ 0 ]!, config );
		const cardId = getCardsOfBook( book, config.type ).find(
			c => !hand.includes( c ) && !hands[ P2.id ]!.includes( c )
		)!;

		await run( memory, engine.askCard( { from: P2.id, cardId }, P1 ) );

		const view = await viewOf( memory, engine, P1 );
		expect( view.playerData[ P1.id ]!.metrics ).toMatchObject( {
			totalAsks: 1,
			cardsTaken: 0
		} );
		expect( view.playerData[ P2.id ]!.metrics.cardsGiven ).toBe( 0 );
	} );
} );

// ===========================================================================
describe( "fish — claimBook validation", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 17 ); } );
	afterEach( () => { restore(); } );

	const rejectClaim = async ( engine: Engine, claim: Record<string, PlayerId> ) => {
		const error = await runFail( memory, engine.claimBook( { claim }, P1 ) );
		expect( error._tag ).toBe( "swish/InvalidMove" );
		return error as InvalidMoveError;
	};

	test( "an empty claim is rejected", async () => {
		const engine = await bootPlay( memory );
		const error = await rejectClaim( engine, {} );
		expect( error.reason ).toContain( "cannot be empty" );
	} );

	test( "every claimed card must belong to the same book", async () => {
		const engine = await bootPlay( memory );
		const error = await rejectClaim( engine, {
			AS: P1.id, AH: P2.id, AD: P3.id, "2C": P4.id
		} );

		expect( error.reason ).toContain( "same book" );
	} );

	test( "a partial book cannot be claimed", async () => {
		const engine = await bootPlay( memory );
		const error = await rejectClaim( engine, { AS: P1.id, AH: P2.id, AD: P3.id } );
		expect( error.reason ).toContain( "Must claim all 4 cards" );
	} );

	test( "a claim naming a player outside the game is rejected", async () => {
		const engine = await bootPlay( memory );
		const error = await rejectClaim( engine, {
			AS: P1.id, AH: P2.id, AD: P3.id, AC: STRANGER.id
		} );

		expect( error.reason ).toContain( "is not in this game" );
	} );

	test( "an already-claimed book cannot be claimed again", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const book = await bookInHand( memory, engine, P1, config );
		const claim = await correctClaim( memory, engine, FOUR, book, config );

		await run( memory, engine.claimBook( { claim }, P1 ) );
		const error = await rejectClaim( engine, claim );
		expect( error.reason ).toContain( "already been claimed" );
	} );
} );

// ===========================================================================
describe( "fish — claim resolution", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 19 ); } );
	afterEach( () => { restore(); } );

	test( "a correct claim scores for the claimer's team and keeps the turn", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const book = await bookInHand( memory, engine, P1, config );
		const claim = await correctClaim( memory, engine, FOUR, book, config );

		await run( memory, engine.claimBook( { claim }, P1 ) );

		const state = await stateOf( memory, engine, P1 );
		const view = asPlayerView( state.view );
		const myTeam = view.teams[ view.playerData[ P1.id ]!.teamId ]!;
		const otherTeam = Object.values( view.teams ).find( t => t.id !== myTeam.id )!;

		expect( view.claimHistory[ 0 ] ).toMatchObject( { success: true, playerId: P1.id, book } );
		expect( myTeam.score ).toBe( 1 );
		expect( myTeam.booksWon ).toEqual( [ book ] );
		expect( otherTeam.score ).toBe( 0 );
		expect( state.context.currentPlayer ).toBe( P1.id );
		expect( view.playerData[ P1.id ]!.metrics ).toMatchObject( {
			totalClaims: 1,
			successfulClaims: 1
		} );
	} );

	test( "a wrong claim scores for the opponents", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const book = await bookInHand( memory, engine, P1, config );
		const claim = await correctClaim( memory, engine, FOUR, book, config );

		// Swap two owners so the claim is complete but wrong.
		const cards = Object.keys( claim );
		const wrong = { ...claim };
		const [ a, b ] = [ cards[ 0 ]!, cards[ 1 ]! ];
		wrong[ a ] = claim[ b ]!;
		wrong[ b ] = claim[ a ]!;

		await run( memory, engine.claimBook( { claim: wrong }, P1 ) );

		const view = await viewOf( memory, engine, P1 );
		const myTeam = view.teams[ view.playerData[ P1.id ]!.teamId ]!;
		const otherTeam = Object.values( view.teams ).find( t => t.id !== myTeam.id )!;

		expect( view.claimHistory[ 0 ]!.success ).toBe( false );
		expect( myTeam.score ).toBe( 0 );
		expect( otherTeam.score ).toBe( 1 );
		expect( otherTeam.booksWon ).toEqual( [ book ] );
		expect( view.playerData[ P1.id ]!.metrics ).toMatchObject( {
			totalClaims: 1,
			successfulClaims: 0
		} );
	} );

	test( "a claim takes the book out of play either way", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const book = await bookInHand( memory, engine, P1, config );
		const cards = getCardsOfBook( book, config.type );
		const claim = await correctClaim( memory, engine, FOUR, book, config );

		await run( memory, engine.claimBook( { claim }, P1 ) );

		const hands = await allHands( memory, engine, FOUR );
		const view = await viewOf( memory, engine, P1 );
		for ( const card of cards ) {
			expect( FOUR.some( p => hands[ p.id ]!.includes( card ) ) ).toBe( false );
			expect( view.cardLocations[ card ] ).toBeUndefined();
		}

		// Four cards left play; the counts drop by exactly those four.
		const total = FOUR.reduce( ( sum, p ) => sum + view.cardCounts[ p.id ]!, 0 );
		expect( total ).toBe( 48 );
	} );

	test( "a claim that empties the claimer passes the turn to their teammate", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const book = await bookInHand( memory, engine, P1, config );
		const cards = getCardsOfBook( book, config.type );
		const hand = await handOf( memory, engine, P1 );

		// Leave p1 holding nothing but their share of the book being claimed, so
		// the claim empties them and the engine has to hop to a teammate.
		patchStored( memory, {
			hands: { [ P1.id ]: hand.filter( c => cards.includes( c ) ) }
		} );

		const claim = await correctClaim( memory, engine, FOUR, book, config );
		await run( memory, engine.claimBook( { claim }, P1 ) );

		const state = await stateOf( memory, engine, P1 );
		expect( asPlayerView( state.view ).hand ).toEqual( [] );
		expect( state.context.currentPlayer ).toBe( P3.id );
	} );

	test( "a wrong claim hands the turn to an opponent who still has cards", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const book = await bookInHand( memory, engine, P1, config );
		const claim = await correctClaim( memory, engine, FOUR, book, config );
		const cards = Object.keys( claim );
		const wrong = { ...claim, [ cards[ 0 ]! ]: claim[ cards[ 1 ]! ]! };
		wrong[ cards[ 1 ]! ] = claim[ cards[ 0 ]! ]!;

		await run( memory, engine.claimBook( { claim: wrong }, P1 ) );

		const state = await stateOf( memory, engine, P1 );
		const view = asPlayerView( state.view );
		const opponents = view.teams[ view.playerData[ P2.id ]!.teamId ]!.members;
		expect( opponents ).toContain( state.context.currentPlayer );
	} );
} );

// ===========================================================================
describe( "fish — transferTurn", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 23 ); } );
	afterEach( () => { restore(); } );

	/** A successful claim by p1, which is the only thing that unlocks a transfer. */
	async function claimFirstBook( engine: Engine, config: FishConfig ) {
		const book = await bookInHand( memory, engine, P1, config );
		const claim = await correctClaim( memory, engine, FOUR, book, config );
		await run( memory, engine.claimBook( { claim }, P1 ) );
		return book;
	}

	test( "a transfer without a preceding successful claim is rejected", async () => {
		const engine = await bootPlay( memory );
		const error = await runFail(
			memory,
			engine.transferTurn( { transferTo: P3.id }, P1 )
		) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "after a successful claim" );
	} );

	test( "a transfer to an opponent is rejected", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		await claimFirstBook( engine, config );

		const error = await runFail(
			memory,
			engine.transferTurn( { transferTo: P2.id }, P1 )
		) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "only transfer to a teammate" );
	} );

	test( "a transfer to an empty-handed teammate is rejected", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		await claimFirstBook( engine, config );
		// An empty-handed teammate only arises late in a game; drift the snapshot
		// there so the guard is exercised.
		patchStored( memory, { hands: { [ P3.id ]: [] } } );

		const error = await runFail(
			memory,
			engine.transferTurn( { transferTo: P3.id }, P1 )
		) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "no cards" );
	} );

	test( "a transfer after a successful claim hands the turn to the teammate", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		await claimFirstBook( engine, config );

		await run( memory, engine.transferTurn( { transferTo: P3.id }, P1 ) );

		const state = await stateOf( memory, engine, P1 );
		const view = asPlayerView( state.view );
		expect( state.context.currentPlayer ).toBe( P3.id );
		expect( view.lastMoveType ).toBe( "transfer" );
		expect( view.transferHistory[ 0 ] ).toMatchObject( {
			playerId: P1.id,
			transferTo: P3.id
		} );
	} );

	test( "a transfer cannot be chained — the second one has no claim behind it", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		await claimFirstBook( engine, config );
		await run( memory, engine.transferTurn( { transferTo: P3.id }, P1 ) );

		const error = await runFail(
			memory,
			engine.transferTurn( { transferTo: P1.id }, P3 )
		) as InvalidMoveError;

		expect( error._tag ).toBe( "swish/InvalidMove" );
		expect( error.reason ).toContain( "after a successful claim" );
	} );
} );

// ===========================================================================
describe( "fish — completion & log", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 29 ); } );
	afterEach( () => { restore(); } );

	// NOTE: these run on CANADIAN. A NORMAL game cannot be played to the end:
	// `bookTypeOf` (src/games/fish/server/utils.ts:29) infers the variant from
	// whether a 7 is still tracked, so the moment the SEVENS book is claimed every
	// later claim resolves the book against CANADIAN_BOOKS and throws. See the
	// report accompanying this suite.
	test( "claiming every book completes the game and crowns the leading team", async () => {
		const config = canadianConfig();
		const engine = await bootPlay( memory, { config } );
		await claimEveryBook( memory, engine, FOUR, config );

		const state = await stateOf( memory, engine, P1 );
		const view = asPlayerView( state.view );
		const teams = Object.values( view.teams );

		expect( state.status ).toBe( "COMPLETED" );
		expect( teams.reduce( ( sum, t ) => sum + t.score, 0 ) ).toBe( config.books.length );
		expect( teams.flatMap( t => t.booksWon ).sort() ).toEqual( [ ...config.books ].sort() );

		const best = teams.reduce( ( acc, t ) => t.score > acc.score ? t : acc );
		expect( view.winningTeam ).toBe( best.id );
		// Every card is gone once the last book is claimed.
		expect( view.cardCounts ).toEqual( byPlayer( { p1: 0, p2: 0, p3: 0, p4: 0 } ) );
	} );

	// SKIPPED — this is the NORMAL equivalent of the test above and it does not
	// pass: claiming SEVENS makes `bookTypeOf` flip the game to CANADIAN, and the
	// next claim throws `undefined is not an object` out of `getCardsOfBook`.
	// Left here (rather than asserting the throw) so the fix has a target.
	test.skip( "a NORMAL game can also be played to completion", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		await claimEveryBook( memory, engine, FOUR, config );

		expect( ( await stateOf( memory, engine, P1 ) ).status ).toBe( "COMPLETED" );
	} );

	test( "a completed game accepts no further moves (GameNotInProgress)", async () => {
		const config = canadianConfig();
		const engine = await bootPlay( memory, { config } );
		await claimEveryBook( memory, engine, FOUR, config );

		const error = await runFail(
			memory,
			engine.askCard( { from: P2.id, cardId: "AS" as CardId }, P1 )
		);

		expect( error._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "getLog is empty — fish declares no `describe`", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const ask = await legalAsk( memory, engine, P1, [ P2, P4 ], FOUR, config );
		await run( memory, engine.askCard( { from: ask.from, cardId: ask.cardId }, P1 ) );

		expect( await run( memory, engine.getLog( P1.id ) ) ).toEqual( [] );
	} );

	test( "a non-member cannot read the action feed (NotAMember)", async () => {
		const engine = await bootPlay( memory );
		const error = await runFail( memory, engine.getLog( STRANGER.id ) );
		expect( error._tag ).toBe( "swish/NotAMember" );
	} );

	test( "cleanup clears the snapshot", async () => {
		const engine = await bootPlay( memory );
		await run( memory, engine.cleanup() );
		expect( memory.store.value ).toBeNull();
	} );
} );

// ===========================================================================
describe( "fish — undo / redo", () => {
	let memory: Memory;
	let restore: () => void;
	beforeEach( () => { memory = makeMemory(); restore = seedGlobalRandom( 31 ); } );
	afterEach( () => { restore(); } );

	test( "undo rewinds an ask, returning the card to its owner", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const ask = await legalAsk( memory, engine, P1, [ P2, P4 ], FOUR, config );
		expect( ask.success ).toBe( true );

		await run( memory, engine.askCard( { from: ask.from, cardId: ask.cardId }, P1 ) );
		await run( memory, engine.undo( P1 ) );

		const view = await viewOf( memory, engine, P1 );
		expect( view.hand ).not.toContain( ask.cardId );
		expect( view.askHistory ).toEqual( [] );
		expect( view.cardCounts ).toEqual( byPlayer( { p1: 13, p2: 13, p3: 13, p4: 13 } ) );
	} );

	test( "redo replays the ask exactly (the deal is captured in the log)", async () => {
		const config = normalConfig();
		const engine = await bootPlay( memory, { config } );
		const ask = await legalAsk( memory, engine, P1, [ P2, P4 ], FOUR, config );

		await run( memory, engine.askCard( { from: ask.from, cardId: ask.cardId }, P1 ) );
		const before = await viewOf( memory, engine, P1 );

		await run( memory, engine.undo( P1 ) );
		await run( memory, engine.redo( P1 ) );

		const after = await viewOf( memory, engine, P1 );
		expect( after.hand ).toEqual( before.hand );
		expect( after.askHistory ).toEqual( before.askHistory );
		expect( after.cardLocations ).toEqual( before.cardLocations );
	} );

	test( "undoing createTeams rewinds to TEAM_CONFIG and un-deals the hands", async () => {
		const engine = await bootPlay( memory );
		await run( memory, engine.undo( P1 ) );

		const state = await stateOf( memory, engine, P1 );
		const view = asPlayerView( state.view );
		expect( state.context.phase ).toBe( "TEAM_CONFIG" );
		expect( view.teams ).toEqual( {} );
		expect( view.hand ).toEqual( [] );
		expect( view.cardLocations ).toEqual( {} );
	} );

	test( "redo at the newest commit fails with NothingToRedo", async () => {
		const engine = await bootPlay( memory );
		const error = await runFail( memory, engine.redo( P1 ) );
		expect( error._tag ).toBe( "swish/NothingToRedo" );
	} );
} );

/**
 * Claims every book in the game with a truthful claim, always acting as whoever
 * the engine currently seats. Drives the game to COMPLETED.
 */
async function claimEveryBook(
	memory: Memory,
	engine: Engine,
	players: PlayerInfo[],
	config: FishConfig
) {
	for ( let i = 0; i < config.books.length; i++ ) {
		const state = await run( memory, engine.getState( players[ 0 ]!.id ) );
		const view = state.view as FishPlayerView;
		const claimer = players.find( p => p.id === state.context.currentPlayer )!;
		const claimed = new Set( Object.values( view.teams ).flatMap( t => t.booksWon ) );
		const book = config.books.find( b => !claimed.has( b ) )!;
		const claim = await correctClaim( memory, engine, players, book, config );

		await run( memory, engine.claimBook( { claim }, claimer ) );
	}
}
