import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import type { Table } from "@tests/harness/table";
import { makeTable, PARKED, rejectionTag } from "@tests/harness/table";
import { makeUsers } from "@tests/harness/users";

import type { Card } from "@/games/splendor/schema";
import {
	SPLENDOR_GOLD_SUPPLY,
	SPLENDOR_MAX_RESERVED,
	SPLENDOR_MAX_TOKENS,
	SPLENDOR_NOBLE_TIMEOUT_MILLIS,
	SPLENDOR_NOBLE_VISIT,
	SPLENDOR_OPEN_CARDS
} from "@/games/splendor/schema";
import {
	SplendorEngine,
	SplendorEngineLive,
	SplendorStructure
} from "@/games/splendor/server/engine";
import { ALL_GEMS, GEMS, paymentFor, qualifyingNobles, sumTokens } from "@/games/splendor/utils";
import type { PlayerId } from "@/swish/schema";


const Splendor = {
	Engine: SplendorEngine,
	EngineLive: SplendorEngineLive,
	Structure: SplendorStructure
};

const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;

const DUEL = Object.values( makeUsers( [ "alice", "bob" ] as const ) );

type SplendorTable = Table<typeof SplendorStructure>;

const seated = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* makeTable( Splendor, {
		players: DUEL,
		name,
		config: { playerCount: 2, winningPoints: 15, ...PARKED, ...config }
	} );

	yield* game.joinAll();
	return game;
} );

/**
 * Takes a legal set of gems for whoever the cursor is on, and hands back
 * whatever the ten-token limit asks for.
 *
 * Adaptive rather than fixed: a table of two holds only four of each gem, so a
 * hard-coded set runs the bank dry a few turns in — and under-taking is refused,
 * so the set has to be the largest one the bank can still manage.
 */
const takeSome = ( game: SplendorTable ) => Effect.gen( function* () {
	const view = yield* game.view();
	const seat = view.context.currentPlayer!;
	const player = view.view.playerData[ seat ]!;

	const available = GEMS.filter( gem => view.view.tokens[ gem ] > 0 );
	const picked = available
		.toSorted( ( a, b ) => view.view.tokens[ b ] - view.view.tokens[ a ] )
		.slice( 0, 3 );

	if ( picked.length === 0 ) {
		yield* game.move( seat, "passTurn", {} );
		return seat;
	}

	const tokens = Object.fromEntries( picked.map( gem => [ gem, 1 ] ) );
	const held = sumTokens( player.tokens );
	const excess = Math.max( 0, held + picked.length - SPLENDOR_MAX_TOKENS );

	const returned: Record<string, number> = {};
	let left = excess;
	for ( const gem of ALL_GEMS ) {
		if ( left === 0 ) {
			break;
		}

		const have = player.tokens[ gem ] + ( tokens[ gem ] ?? 0 );
		const give = Math.min( have, left );
		if ( give > 0 ) {
			returned[ gem ] = give;
			left -= give;
		}
	}

	yield* game.move( seat, "pickTokens", {
		tokens,
		...( excess > 0 ? { returned } : {} )
	} );

	return seat;
} );


describe( "splendor flow", () => {

	describe( "the board", () => {

		it.live( "deals the bank, the rows and the nobles", () => Effect.gen( function* () {
			const game = yield* seated( "board-start" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "IN_PROGRESS" );

			// A table of two plays with four of each gem.
			assert.strictEqual( view.view.tokens.ruby, 4 );
			assert.strictEqual( view.view.tokens.gold, SPLENDOR_GOLD_SUPPLY );

			for ( const level of [ 1, 2, 3 ] as const ) {
				assert.strictEqual( view.view.cards[ level ].length, SPLENDOR_OPEN_CARDS );
			}

			// One more noble than there are seats, so somebody always misses out.
			assert.strictEqual( view.view.nobles.length, 3 );
		} ) );

		it.live( "seeds every seat empty", () => Effect.gen( function* () {
			const game = yield* seated( "board-seats" );
			const view = yield* game.view();

			for ( const player of Object.values( view.view.playerData ) ) {
				assert.strictEqual( player.points, 0 );
				assert.deepStrictEqual( [ ...player.cards ], [] );
				assert.deepStrictEqual( [ ...player.reserved ], [] );
				assert.strictEqual( Object.values( player.tokens ).reduce( ( a, b ) => a + b, 0 ), 0 );
			}
		} ) );

		it.live( "hides the deck order and nothing else", () => Effect.gen( function* () {
			const game = yield* seated( "board-redaction" );

			const table = yield* game.state();
			const mine = yield* game.state( "alice" );

			assert.notProperty( table, "decks" );
			assert.deepStrictEqual( table.deckCounts, mine.deckCounts );
			assert.deepStrictEqual( { ...table, playerId: alice }, { ...mine } );
		} ) );

		it.live( "sizes the bank up for a bigger table", () => Effect.gen( function* () {
			const game = yield* makeTable( Splendor, {
				players: Object.values( makeUsers( [ "alice", "bob", "carol", "dave" ] as const ) ),
				name: "board-four",
				config: { playerCount: 4, winningPoints: 15, ...PARKED }
			} );

			yield* game.joinAll();

			const view = yield* game.view();
			assert.strictEqual( view.view.tokens.ruby, 7 );
			assert.strictEqual( view.view.nobles.length, 5 );
		} ) );
	} );

	describe( "taking gems", () => {

		it.live(
			"moves three gems from the bank to the seat, then passes the turn",
			() => Effect.gen( function* () {
				const game = yield* seated( "gems-three" );
				yield* game.move( "alice", "pickTokens", {
					tokens: { diamond: 1, sapphire: 1, emerald: 1 }
				} );

				const view = yield* game.view();
				assert.strictEqual( view.view.playerData[ alice ]?.tokens.diamond, 1 );
				assert.strictEqual( view.view.tokens.diamond, 3 );
				assert.strictEqual( view.context.currentPlayer, bob );
			} )
		);

		it.live( "takes two of a kind from a deep pile", () => Effect.gen( function* () {
			const game = yield* seated( "gems-double" );
			yield* game.move( "alice", "pickTokens", { tokens: { ruby: 2 } } );

			const view = yield* game.view();
			assert.strictEqual( view.view.playerData[ alice ]?.tokens.ruby, 2 );
			assert.strictEqual( view.view.tokens.ruby, 2 );
		} ) );

		it.live( "refuses two of a kind once the pile is shallow", () => Effect.gen( function* () {
			const game = yield* seated( "gems-shallow" );

			yield* game.move( "alice", "pickTokens", { tokens: { ruby: 2 } } );
			yield* game.move( "bob", "pickTokens", { tokens: { diamond: 1, sapphire: 1, emerald: 1 } } );

			// Two left in the pile: not enough to take two of them.
			const tag = yield* rejectionTag(
				game.move( "alice", "pickTokens", { tokens: { ruby: 2 } } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "refuses under-taking", () => Effect.gen( function* () {
			const game = yield* seated( "gems-under" );
			const tag = yield* rejectionTag(
				game.move( "alice", "pickTokens", { tokens: { ruby: 1 } } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "refuses taking gold", () => Effect.gen( function* () {
			const game = yield* seated( "gems-gold" );
			const tag = yield* rejectionTag(
				game.move( "alice", "pickTokens", { tokens: { gold: 1 } } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "never leaves a seat holding eleven", () => Effect.gen( function* () {
			const game = yield* seated( "gems-limit" );

			// Take until alice is close enough to the ceiling that the next take
			// would carry her over it.
			for ( let turn = 0; turn < 8; turn++ ) {
				const view = yield* game.view();
				const held = sumTokens( view.view.playerData[ alice ]!.tokens );

				if ( view.context.currentPlayer === alice && held > SPLENDOR_MAX_TOKENS - 3 ) {
					break;
				}

				yield* takeSome( game );
			}

			const before = yield* game.view();
			const held = sumTokens( before.view.playerData[ alice ]!.tokens );

			assert.isAbove( held, SPLENDOR_MAX_TOKENS - 3 );
			assert.strictEqual( before.context.currentPlayer, alice );

			const picked = GEMS.filter( gem => before.view.tokens[ gem ] > 0 ).slice( 0, 3 );
			const tokens = Object.fromEntries( picked.map( gem => [ gem, 1 ] ) );

			// The limit is settled inside the move, so a take that would carry the
			// seat over it is refused outright rather than paid for afterwards.
			const refused = yield* rejectionTag( game.move( "alice", "pickTokens", { tokens } ) );
			assert.strictEqual( refused, "swish/InvalidMove" );

			yield* takeSome( game );

			const after = yield* game.view();
			assert.strictEqual(
				sumTokens( after.view.playerData[ alice ]!.tokens ),
				SPLENDOR_MAX_TOKENS
			);
		} ) );

		it.live( "refuses a take out of turn", () => Effect.gen( function* () {
			const game = yield* seated( "gems-order" );
			const tag = yield* rejectionTag(
				game.move( "bob", "pickTokens", { tokens: { ruby: 2 } } )
			);

			assert.strictEqual( tag, "swish/NotYourTurn" );
		} ) );
	} );

	describe( "reserving", () => {

		it.live(
			"takes the card off the row and replaces it, with the gold",
			() => Effect.gen( function* () {
				const game = yield* seated( "reserve-take" );
				const before = yield* game.view();
				const target = before.view.cards[ 1 ][ 0 ]!;

				yield* game.move( "alice", "reserveCard", { cardId: target.id, withGold: true } );

				const view = yield* game.view();
				const player = view.view.playerData[ alice ]!;

				assert.deepStrictEqual( player.reserved.map( card => card.id ), [ target.id ] );
				assert.strictEqual( player.tokens.gold, 1 );
				assert.strictEqual( view.view.tokens.gold, SPLENDOR_GOLD_SUPPLY - 1 );
				assert.strictEqual( view.view.cards[ 1 ].length, SPLENDOR_OPEN_CARDS );
				assert.notInclude( view.view.cards[ 1 ].map( card => card.id ), target.id );
			} )
		);

		it.live( "publishes a reserved card to everybody", () => Effect.gen( function* () {
			// They were face up when they were taken; the whole point of the limits
			// is that everyone can see what everyone else is building.
			const game = yield* seated( "reserve-public" );
			const target = ( yield* game.view() ).view.cards[ 1 ][ 0 ]!;

			yield* game.move( "alice", "reserveCard", { cardId: target.id, withGold: false } );

			const table = yield* game.state();
			assert.deepStrictEqual(
				table.playerData[ alice ]?.reserved.map( card => card.id ),
				[ target.id ]
			);
		} ) );

		it.live( "refuses a card that is not face up", () => Effect.gen( function* () {
			const game = yield* seated( "reserve-unknown" );
			const tag = yield* rejectionTag(
				game.move( "alice", "reserveCard", { cardId: "not-a-card", withGold: false } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "refuses a fourth reservation", () => Effect.gen( function* () {
			const game = yield* seated( "reserve-limit" );

			for ( let i = 0; i < SPLENDOR_MAX_RESERVED; i++ ) {
				const view = yield* game.view();
				yield* game.move( "alice", "reserveCard", {
					cardId: view.view.cards[ 1 ][ 0 ]!.id,
					withGold: false
				} );
				yield* takeSome( game );
			}

			const view = yield* game.view();
			assert.strictEqual( view.view.playerData[ alice ]?.reserved.length, SPLENDOR_MAX_RESERVED );

			const tag = yield* rejectionTag( game.move( "alice", "reserveCard", {
				cardId: view.view.cards[ 1 ][ 0 ]!.id,
				withGold: false
			} ) );

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );
	} );

	describe( "buying", () => {

		it.live( "buys a card it can pay for, off the board", () => Effect.gen( function* () {
			const game = yield* seated( "buy-board" );

			// Take gems until something on the cheapest row is affordable.
			let bought: string | undefined;

			for ( let turn = 0; turn < 12 && !bought; turn++ ) {
				const view = yield* game.view();
				const seat = view.context.currentPlayer!;

				if ( seat === alice ) {
					const player = view.view.playerData[ alice ]!;
					const target = view.view.cards[ 1 ].find(
						card => paymentFor( card, player.tokens, player.cards ) !== undefined
					);

					if ( target ) {
						const payment = paymentFor( target, player.tokens, player.cards )!;
						yield* game.move( "alice", "purchaseCard", { cardId: target.id, payment } );
						bought = target.id;
						continue;
					}
				}

				yield* takeSome( game );
			}

			assert.isDefined( bought, "a level-one card became affordable" );

			const view = yield* game.view();
			const player = view.view.playerData[ alice ]!;

			assert.deepStrictEqual( player.cards.map( card => card.id ), [ bought ] );
			assert.strictEqual(
				view.view.cards[ 1 ].length,
				SPLENDOR_OPEN_CARDS,
				"replaced from the deck"
			);
		} ) );

		it.live( "refuses a payment that does not settle exactly", () => Effect.gen( function* () {
			const game = yield* seated( "buy-inexact" );
			yield* game.move(
				"alice",
				"pickTokens",
				{ tokens: { diamond: 1, sapphire: 1, emerald: 1 } }
			);
			yield* game.move( "bob", "pickTokens", { tokens: { ruby: 1, onyx: 1, diamond: 1 } } );

			const view = yield* game.view();
			const target = view.view.cards[ 1 ][ 0 ]!;

			const tag = yield* rejectionTag( game.move( "alice", "purchaseCard", {
				cardId: target.id,
				payment: { diamond: 1 }
			} ) );

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live(
			"refuses a card that is neither on the table nor reserved",
			() => Effect.gen( function* () {
				const game = yield* seated( "buy-unknown" );
				const tag = yield* rejectionTag(
					game.move( "alice", "purchaseCard", { cardId: "not-a-card", payment: {} } )
				);

				assert.strictEqual( tag, "swish/InvalidMove" );
			} )
		);

		it.live(
			"buys out of its own reserve, leaving the board alone",
			() => Effect.gen( function* () {
				const game = yield* seated( "buy-reserved" );

				// The cheapest card on the row, so it comes within reach before the bank
				// runs dry.
				const first = [ ...( yield* game.view() ).view.cards[ 1 ] ].sort(
					( a, b ) => sumTokens( a.cost ) - sumTokens( b.cost )
				)[ 0 ]!;

				yield* game.move( "alice", "reserveCard", { cardId: first.id, withGold: true } );

				// Take gems until the reserved card is affordable.
				let bought = false;
				for ( let turn = 0; turn < 40 && !bought; turn++ ) {
					const view = yield* game.view();
					const seat = view.context.currentPlayer!;

					if ( seat === alice ) {
						const player = view.view.playerData[ alice ]!;
						const payment = paymentFor( first, player.tokens, player.cards );

						if ( payment ) {
							const rowBefore = view.view.cards[ 1 ].map( card => card.id );
							yield* game.move( "alice", "purchaseCard", { cardId: first.id, payment } );

							const after = yield* game.view();
							assert.deepStrictEqual( after.view.cards[ 1 ].map( card => card.id ), rowBefore );
							assert.deepStrictEqual( [ ...after.view.playerData[ alice ]!.reserved ], [] );
							assert.deepStrictEqual(
								after.view.playerData[ alice ]!.cards.map( card => card.id ),
								[ first.id ]
							);

							bought = true;
							continue;
						}
					}

					yield* takeSome( game );
				}

				assert.isTrue( bought, "the reserved card became affordable" );
			} )
		);
	} );

	describe( "the noble visit", () => {

		/**
		 * Plays until one purchase brings two nobles at once.
		 *
		 * The interesting thing about this window is how narrow the path to it is.
		 * A noble that qualifies on its own is awarded by `afterMove` and leaves the
		 * table, so collecting bonuses greedily takes the nobles one at a time and
		 * never opens anything. Two can only arrive together if the purchase that
		 * completes one completes the other in the same breath.
		 *
		 * So the driver plays for exactly that: it will not buy a card that would
		 * bring a single noble, and buys one that would bring two the moment it can.
		 * The deal is fixed by the table's id, so this plays out identically on
		 * every run.
		 */
		const untilTwoWilling = ( game: SplendorTable ) => Effect.gen( function* () {
			// Every test in here plays the same table — `seated( "noble-window" )` —
			// because the deal is what decides whether the path exists at all.
			for ( let turn = 0; turn < 400; turn++ ) {
				const view = yield* game.view();

				if ( view.status !== "IN_PROGRESS" ) {
					return undefined;
				}

				const frame = yield* game.frame();
				if ( frame ) {
					return frame;
				}

				const seat = view.context.currentPlayer!;
				const player = view.view.playerData[ seat ]!;

				const affordable = [
					...view.view.cards[ 1 ],
					...view.view.cards[ 2 ],
					...view.view.cards[ 3 ],
					...player.reserved
				].filter( card => paymentFor( card, player.tokens, player.cards ) !== undefined );

				/** How many nobles this seat would hold court for, having bought a card. */
				const willingAfter = ( card: Card ) => qualifyingNobles(
					[ ...player.cards, card ],
					view.view.nobles
				).length;

				const both = affordable.find( card => willingAfter( card ) > 1 );
				if ( both ) {
					const payment = paymentFor( both, player.tokens, player.cards )!;
					yield* game.move( seat, "purchaseCard", { cardId: both.id, payment } );
					continue;
				}

				// Anything that would bring a single noble is left alone: it would be
				// awarded outright, and the pair would never come together.
				const safe = affordable.filter( card => willingAfter( card ) === 0 );
				if ( safe.length > 0 ) {
					const cheapest = safe.reduce( ( best, card ) =>
						sumTokens( card.cost ) < sumTokens( best.cost ) ? card : best );

					const payment = paymentFor( cheapest, player.tokens, player.cards )!;
					yield* game.move( seat, "purchaseCard", { cardId: cheapest.id, payment } );
					continue;
				}

				yield* takeSome( game );
			}

			return undefined;
		} );

		it.live( "opens on a purchase that leaves two nobles willing", () => Effect.gen( function* () {
			const game = yield* seated( "noble-window", { winningPoints: 20 } );
			const frame = yield* untilTwoWilling( game );

			assert.isDefined( frame, "the table reached a two-noble purchase" );
			assert.strictEqual( frame?.kind, SPLENDOR_NOBLE_VISIT );
			assert.strictEqual( frame?.responders.length, 1, "only the buyer is asked" );
			assert.isFalse( frame!.allowPass, "a visit is not declined into nothing" );
			assert.strictEqual( frame?.timeoutMillis, SPLENDOR_NOBLE_TIMEOUT_MILLIS );

			// The kind's own move list, filled in from the declaration on the way in.
			assert.deepStrictEqual( frame?.options.map( option => option.move ), [ "claimNoble" ] );

			// The turn is held, not passed on.
			const view = yield* game.view();
			assert.strictEqual( view.context.currentPlayer, frame!.responders[ 0 ] );
			assert.strictEqual( view.context.suspended?.moveType, "purchaseCard" );
		} ), 30_000 );

		it.live(
			"takes the noble the buyer chooses and leaves the rest",
			() => Effect.gen( function* () {
				const game = yield* seated( "noble-window", { winningPoints: 20 } );
				const frame = yield* untilTwoWilling( game );
				assert.isDefined( frame );

				const buyer = frame!.responders[ 0 ]!;
				const before = yield* game.view();
				const willing = qualifyingNobles(
					before.view.playerData[ buyer ]!.cards,
					before.view.nobles
				);

				assert.isAbove( willing.length, 1, "there is a real choice" );

				const chosen = willing[ 1 ]!;
				yield* game.respond( buyer, "claimNoble", { nobleId: chosen.id } );

				const after = yield* game.view();
				assert.isUndefined( yield* game.frame(), "the window settles" );
				assert.deepStrictEqual(
					after.view.playerData[ buyer ]!.nobles.map( noble => noble.id ),
					[ chosen.id ]
				);
				assert.notInclude( after.view.nobles.map( noble => noble.id ), chosen.id );
				assert.include( after.view.nobles.map( noble => noble.id ), willing[ 0 ]!.id );

				// One visit per turn, and the turn moves on.
				assert.strictEqual(
					after.view.playerData[ buyer ]!.points - before.view.playerData[ buyer ]!.points,
					chosen.points
				);
				assert.notStrictEqual( after.context.currentPlayer, buyer );
				assert.isUndefined( after.context.suspended );
			} ),
			30_000
		);

		it.live( "refuses a noble the buyer does not qualify for", () => Effect.gen( function* () {
			const game = yield* seated( "noble-window", { winningPoints: 20 } );
			const frame = yield* untilTwoWilling( game );
			assert.isDefined( frame );

			const buyer = frame!.responders[ 0 ]!;
			const view = yield* game.view();
			const willing = qualifyingNobles( view.view.playerData[ buyer ]!.cards, view.view.nobles );
			const unwilling = view.view.nobles.find(
				noble => !willing.some( candidate => candidate.id === noble.id )
			);

			if ( !unwilling ) {
				return;
			}

			assert.strictEqual(
				yield* rejectionTag( game.respond( buyer, "claimNoble", { nobleId: unwilling.id } ) ),
				"swish/InvalidMove"
			);
		} ), 30_000 );

		it.live( "will not let the choice be declined", () => Effect.gen( function* () {
			const game = yield* seated( "noble-window", { winningPoints: 20 } );
			const frame = yield* untilTwoWilling( game );
			assert.isDefined( frame );

			assert.strictEqual(
				yield* rejectionTag( game.pass( frame!.responders[ 0 ]! ) ),
				"swish/PassNotAllowed"
			);
		} ), 30_000 );

		it.live( "refuses claiming a noble with no window open", () => Effect.gen( function* () {
			const game = yield* seated( "noble-unasked" );
			const view = yield* game.view();

			assert.strictEqual(
				yield* rejectionTag( game.move( "alice", "claimNoble", {
					nobleId: view.view.nobles[ 0 ]!.id
				} ) ),
				"swish/InvalidMove"
			);
		} ) );
	} );

	describe( "passing", () => {

		it.live( "refuses a seat that still has something to do", () => Effect.gen( function* () {
			const game = yield* seated( "pass-refused" );
			const tag = yield* rejectionTag( game.move( "alice", "passTurn", {} ) );
			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );
	} );

	describe( "undo", () => {

		it.live( "takes a take back, gems and all", () => Effect.gen( function* () {
			const game = yield* seated( "undo-take" );
			yield* game.move( "alice", "pickTokens", { tokens: { ruby: 2 } } );
			yield* game.undo( "alice" );

			const view = yield* game.view();
			assert.strictEqual( view.view.tokens.ruby, 4 );
			assert.strictEqual( view.view.playerData[ alice ]?.tokens.ruby, 0 );
			assert.strictEqual( view.context.currentPlayer, alice );
		} ) );
	} );

	describe( "bots", () => {

		it.live( "plays a whole duel out to a winner", () => Effect.gen( function* () {
			const game = yield* makeTable( Splendor, {
				players: DUEL,
				name: "bot-duel",
				config: {
					playerCount: 2,
					winningPoints: 10,
					botDelayMillis: 1,
					moveTimeoutMillis: 20
				}
			} );

			yield* game.joinAll();

			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 120 )
			);

			assert.strictEqual( view.results?.ranking.length, 2 );

			// The round completes before the game does, so the leader is at or past
			// the target and everybody has had the same number of turns.
			const best = Math.max(
				...Object.values( view.view.playerData ).map( player => player.points )
			);

			assert.isAtLeast( best, 10 );
			assert.strictEqual( view.context.turn % 2, 0 );
		} ), 180_000 );

		it.live( "never awards two nobles for one purchase", () => Effect.gen( function* () {
			// `afterMove` awards the lone qualifying noble; the choice between two is
			// meant to be a window. Either way one visit per turn is the rule.
			const game = yield* makeTable( Splendor, {
				players: DUEL,
				name: "bot-nobles",
				config: {
					playerCount: 2,
					winningPoints: 10,
					botDelayMillis: 1,
					moveTimeoutMillis: 20
				}
			} );

			yield* game.joinAll();

			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 120 )
			);

			const claimed = Object.values( view.view.playerData )
				.flatMap( player => player.nobles.map( noble => noble.id ) );

			assert.strictEqual( new Set( claimed ).size, claimed.length, "no noble visits twice" );

			// Every noble a seat holds is one it actually qualifies for.
			for ( const player of Object.values( view.view.playerData ) ) {
				assert.deepStrictEqual(
					qualifyingNobles( player.cards, player.nobles ).map( noble => noble.id ),
					player.nobles.map( noble => noble.id )
				);
			}
		} ), 180_000 );
	} );
} );
