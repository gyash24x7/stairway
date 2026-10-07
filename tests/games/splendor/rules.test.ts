import { assert, describe, it } from "@effect/vitest";

import { atPosition } from "@tests/harness/position";

import type {
	Card,
	Cost,
	Noble,
	PlayerData,
	SplendorConfig,
	SplendorState,
	Tokens
} from "@/games/splendor/schema";
import {
	SplendorConfig as Config,
	SPLENDOR_MAX_RESERVED,
	SPLENDOR_MAX_TOKENS,
	SPLENDOR_NOBLE_VISIT
} from "@/games/splendor/schema";
import { SplendorStructure } from "@/games/splendor/server/engine";
import { DEFAULT_COST, DEFAULT_TOKENS } from "@/games/splendor/utils";
import type { PlayerId } from "@/swish/schema";
import { InteractionFrame, InteractionOption, PlayerAudience, TableAudience } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;

const cost = ( overrides: Partial<Cost> = {} ): Cost => ( { ...DEFAULT_COST, ...overrides } );
const tokens = ( overrides: Partial<Tokens> = {} ): Tokens => ( { ...DEFAULT_TOKENS, ...overrides } );

const card = ( overrides: Partial<Card> = {} ): Card => ( {
	id: "c1",
	level: 1,
	points: 0,
	bonus: "ruby",
	cost: cost(),
	...overrides
} );

const seat = ( overrides: Partial<PlayerData> = {} ): PlayerData => ( {
	tokens: tokens(),
	cards: [],
	nobles: [],
	reserved: [],
	points: 0,
	...overrides
} );

const config = ( overrides: Partial<SplendorConfig> = {} ): SplendorConfig => Config.make( {
	playerCount: 2,
	winningPoints: 15,
	autoStart: true,
	botDelayMillis: 5_000,
	moveTimeoutMillis: 120_000,
	...overrides
} );

const at = (
	state: Partial<SplendorState> = {},
	current: PlayerId = alice,
	overrides: Partial<SplendorConfig> = {},
	turn = 0
) => atPosition( SplendorStructure, {
	state: {
		tokens: tokens( { diamond: 4, sapphire: 4, emerald: 4, ruby: 4, onyx: 4, gold: 5 } ),
		cards: { 1: [], 2: [], 3: [] },
		nobles: [],
		decks: { 1: [], 2: [], 3: [] },
		playerData: { [ alice ]: seat(), [ bob ]: seat() },
		...state
	},
	config: config( overrides ),
	context: { players: [ alice, bob ], currentPlayer: current, turn }
} );

const tags = ( events: ReadonlyArray<unknown> ) =>
	events.map( event => ( event as { _tag: string } )._tag );

/** The window a `claimNoble` is an answer to. */
const nobleWindow = ( playerId: PlayerId = alice ) => InteractionFrame.make( {
	id: "noble-1",
	kind: SPLENDOR_NOBLE_VISIT,
	initiator: playerId,
	subject: playerId,
	responders: [ playerId ],
	pending: [ playerId ],
	responses: [],
	options: [ InteractionOption.make( { move: "claimNoble" } ) ],
	resolution: "all",
	allowPass: false,
	secret: false,
	openedAtTurn: 0
} );


describe( "splendor rules", () => {

	describe( "onStart", () => {

		it( "sizes the bank to the seats and seeds every seat", () => {
			const game = at();
			const events = game.onStart();

			assert.deepStrictEqual( tags( events ), [
				"splendor/ev/GameDealt",
				"splendor/ev/PlayerDataInitialized",
				"splendor/ev/PlayerDataInitialized"
			] );

			game.apply( ...events );

			// A table of two plays with four of each gem.
			assert.strictEqual( game.state.tokens.ruby, 4 );
			assert.strictEqual( game.state.tokens.gold, 5 );
		} );

		it( "turns four cards of each level face up", () => {
			const game = at();
			game.apply( ...game.onStart() );

			for ( const level of [ 1, 2, 3 ] as const ) {
				assert.strictEqual( game.state.cards[ level ].length, 4, `level ${ level }` );
				assert.isAbove( game.state.decks[ level ].length, 0 );
			}
		} );

		it( "draws one more noble than there are seats", () => {
			const game = at();
			game.apply( ...game.onStart() );
			assert.strictEqual( game.state.nobles.length, 3 );
		} );

		it( "sizes the bank up for a bigger table", () => {
			const game = at( {}, alice, { playerCount: 4 } );
			game.apply( ...game.onStart() );
			assert.strictEqual( game.state.tokens.ruby, 7 );
		} );
	} );

	describe( "pickTokens", () => {

		it( "accepts three different gems", () => {
			assert.isUndefined(
				at().validate( "pickTokens", alice, { tokens: { ruby: 1, onyx: 1, diamond: 1 } } )
			);
		} );

		it( "refuses taking gold", () => {
			const invalid = at().validate( "pickTokens", alice, { tokens: { gold: 1 } } );
			assert.include( invalid?.reason ?? "", "only ever taken with a reservation" );
		} );

		it( "refuses taking nothing", () => {
			const invalid = at().validate( "pickTokens", alice, { tokens: {} } );
			assert.include( invalid?.reason ?? "", "at least one gem" );
		} );

		it( "refuses more than the bank holds", () => {
			const game = at( { tokens: tokens( { ruby: 1 } ) } );
			const invalid = game.validate( "pickTokens", alice, { tokens: { ruby: 2 } } );
			assert.include( invalid?.reason ?? "", "bank does not hold that many" );
		} );

		it( "accepts two of a kind from a deep enough pile", () => {
			assert.isUndefined( at().validate( "pickTokens", alice, { tokens: { ruby: 2 } } ) );
		} );

		it( "refuses two of a kind from a shallow pile", () => {
			const game = at( { tokens: tokens( { ruby: 3, onyx: 4, diamond: 4 } ) } );
			const invalid = game.validate( "pickTokens", alice, { tokens: { ruby: 2 } } );
			assert.include( invalid?.reason ?? "", "needs four of them left" );
		} );

		it( "refuses two of a kind alongside anything else", () => {
			const invalid = at().validate( "pickTokens", alice, { tokens: { ruby: 2, onyx: 1 } } );
			assert.include( invalid?.reason ?? "", "two gems and nothing else" );
		} );

		it( "refuses three of a kind", () => {
			const invalid = at().validate( "pickTokens", alice, { tokens: { ruby: 3 } } );
			assert.include( invalid?.reason ?? "", "two gems and nothing else" );
		} );

		it( "refuses under-taking", () => {
			// Otherwise a seat could starve the table by taking one gem a turn.
			const invalid = at().validate( "pickTokens", alice, { tokens: { ruby: 1, onyx: 1 } } );
			assert.include( invalid?.reason ?? "", "Take 3 different gems" );
		} );

		it( "asks for every colour left when the bank cannot manage three", () => {
			const game = at( { tokens: tokens( { ruby: 1, onyx: 1 } ) } );

			assert.isUndefined(
				game.validate( "pickTokens", alice, { tokens: { ruby: 1, onyx: 1 } } )
			);
			assert.isDefined( game.validate( "pickTokens", alice, { tokens: { ruby: 1 } } ) );
		} );

		it( "refuses a hand-back when the seat is under the limit", () => {
			const invalid = at().validate( "pickTokens", alice, {
				tokens: { ruby: 1, onyx: 1, diamond: 1 },
				returned: { ruby: 1 }
			} );

			assert.include( invalid?.reason ?? "", "under the token limit" );
		} );

		it( "requires exactly the excess back when the take goes over ten", () => {
			// Settled inside the move rather than by a follow-up, so a seat is never
			// left mid-turn holding eleven.
			const game = at( {
				playerData: { [ alice ]: seat( { tokens: tokens( { ruby: 9 } ) } ), [ bob ]: seat() }
			} );

			const short = game.validate( "pickTokens", alice, {
				tokens: { sapphire: 1, emerald: 1, diamond: 1 },
				returned: { ruby: 1 }
			} );

			assert.include( short?.reason ?? "", "Put 2 token(s) back" );

			assert.isUndefined( game.validate( "pickTokens", alice, {
				tokens: { sapphire: 1, emerald: 1, diamond: 1 },
				returned: { ruby: 2 }
			} ) );
		} );

		it( "refuses handing back tokens the seat would not hold", () => {
			const game = at( {
				playerData: { [ alice ]: seat( { tokens: tokens( { ruby: 9 } ) } ), [ bob ]: seat() }
			} );

			const invalid = game.validate( "pickTokens", alice, {
				tokens: { sapphire: 1, emerald: 1, diamond: 1 },
				returned: { onyx: 2 }
			} );

			assert.include( invalid?.reason ?? "", "would not hold that many onyx" );
		} );

		it( "lets a seat hand back what it is taking", () => {
			const game = at( {
				playerData: { [ alice ]: seat( { tokens: tokens( { ruby: 10 } ) } ), [ bob ]: seat() }
			} );

			assert.isUndefined( game.validate( "pickTokens", alice, {
				tokens: { sapphire: 1, emerald: 1, diamond: 1 },
				returned: { sapphire: 1, emerald: 1, diamond: 1 }
			} ) );
		} );

		it( "moves the gems from the bank to the seat", () => {
			const game = at();
			game.play( "pickTokens", alice, { tokens: { ruby: 1, onyx: 1, diamond: 1 } } );

			assert.strictEqual( game.state.tokens.ruby, 3 );
			assert.strictEqual( game.state.playerData[ alice ]?.tokens.ruby, 1 );
		} );

		it( "puts the hand-back into the bank", () => {
			const game = at( {
				playerData: { [ alice ]: seat( { tokens: tokens( { ruby: 9 } ) } ), [ bob ]: seat() }
			} );

			game.play( "pickTokens", alice, {
				tokens: { sapphire: 1, emerald: 1, diamond: 1 },
				returned: { ruby: 2 }
			} );

			const player = game.state.playerData[ alice ]!;
			assert.strictEqual( player.tokens.ruby, 7 );
			assert.isAtMost(
				Object.values( player.tokens ).reduce( ( a, b ) => a + b, 0 ),
				SPLENDOR_MAX_TOKENS
			);
			assert.strictEqual( game.state.tokens.ruby, 6 );
		} );
	} );

	describe( "reserveCard", () => {

		const board = ( overrides: Partial<SplendorState> = {} ) => at( {
			cards: { 1: [ card( { id: "open" } ) ], 2: [], 3: [] },
			decks: { 1: [ card( { id: "next" } ) ], 2: [], 3: [] },
			...overrides
		} );

		it( "accepts a face-up card", () => {
			assert.isUndefined(
				board().validate( "reserveCard", alice, { cardId: "open", withGold: true } )
			);
		} );

		it( "refuses a card that is not face up", () => {
			// The printed game lets a seat reserve blind off a deck, but the deck's
			// order is the one thing a client is never told.
			const invalid = board().validate( "reserveCard", alice, {
				cardId: "next",
				withGold: false
			} );

			assert.include( invalid?.reason ?? "", "not face up" );
		} );

		it( "refuses a fourth reservation", () => {
			const game = board( {
				playerData: {
					[ alice ]: seat( {
						reserved: Array.from( { length: SPLENDOR_MAX_RESERVED }, ( _, i ) =>
							card( { id: `r${ i }` } ) )
					} ),
					[ bob ]: seat()
				}
			} );

			const invalid = game.validate( "reserveCard", alice, { cardId: "open", withGold: false } );
			assert.include( invalid?.reason ?? "", "at most 3 cards in reserve" );
		} );

		it( "refuses taking gold there is none of", () => {
			const game = board( { tokens: tokens( { gold: 0, ruby: 4 } ) } );
			const invalid = game.validate( "reserveCard", alice, { cardId: "open", withGold: true } );
			assert.include( invalid?.reason ?? "", "no gold left" );
		} );

		it( "lets a full purse reserve without taking the gold", () => {
			const game = board( {
				playerData: { [ alice ]: seat( { tokens: tokens( { ruby: 10 } ) } ), [ bob ]: seat() }
			} );

			assert.isUndefined(
				game.validate( "reserveCard", alice, { cardId: "open", withGold: false } )
			);
		} );

		it( "asks for a token back when the gold goes over the limit", () => {
			const game = board( {
				playerData: { [ alice ]: seat( { tokens: tokens( { ruby: 10 } ) } ), [ bob ]: seat() }
			} );

			const invalid = game.validate( "reserveCard", alice, { cardId: "open", withGold: true } );
			assert.include( invalid?.reason ?? "", "name a token to put back" );

			assert.isUndefined( game.validate( "reserveCard", alice, {
				cardId: "open",
				withGold: true,
				returnedToken: "ruby"
			} ) );
		} );

		it( "refuses a token back when nothing has to go", () => {
			const invalid = board().validate( "reserveCard", alice, {
				cardId: "open",
				withGold: true,
				returnedToken: "ruby"
			} );

			assert.include( invalid?.reason ?? "", "under the token limit" );
		} );

		it( "refuses handing back a token the seat does not hold", () => {
			const game = board( {
				playerData: { [ alice ]: seat( { tokens: tokens( { ruby: 10 } ) } ), [ bob ]: seat() }
			} );

			const invalid = game.validate( "reserveCard", alice, {
				cardId: "open",
				withGold: true,
				returnedToken: "onyx"
			} );

			assert.include( invalid?.reason ?? "", "do not hold that token" );
		} );

		it( "takes the card off the row and replaces it from the deck", () => {
			const game = board();
			game.play( "reserveCard", alice, { cardId: "open", withGold: true } );

			const player = game.state.playerData[ alice ]!;
			assert.deepStrictEqual( player.reserved.map( item => item.id ), [ "open" ] );
			assert.strictEqual( player.tokens.gold, 1 );
			assert.deepStrictEqual( game.state.cards[ 1 ].map( item => item.id ), [ "next" ] );
			assert.strictEqual( game.state.decks[ 1 ].length, 0 );
		} );

		it( "leaves a gap when the deck is spent", () => {
			const game = board( { decks: { 1: [], 2: [], 3: [] } } );
			game.play( "reserveCard", alice, { cardId: "open", withGold: false } );

			assert.deepStrictEqual( [ ...game.state.cards[ 1 ] ], [] );
		} );
	} );

	describe( "purchaseCard", () => {

		const buying = ( overrides: Partial<SplendorState> = {} ) => at( {
			cards: { 1: [ card( { id: "open", cost: cost( { ruby: 2 } ), points: 1 } ) ], 2: [], 3: [] },
			decks: { 1: [ card( { id: "next" } ) ], 2: [], 3: [] },
			playerData: {
				[ alice ]: seat( { tokens: tokens( { ruby: 3, gold: 1 } ) } ),
				[ bob ]: seat()
			},
			...overrides
		} );

		it( "accepts an exact payment for a face-up card", () => {
			assert.isUndefined(
				buying().validate( "purchaseCard", alice, { cardId: "open", payment: { ruby: 2 } } )
			);
		} );

		it( "refuses a card that is neither on the table nor in reserve", () => {
			const invalid = buying().validate( "purchaseCard", alice, {
				cardId: "next",
				payment: {}
			} );

			assert.include( invalid?.reason ?? "", "neither on the table nor in your reserve" );
		} );

		it( "refuses a payment that does not settle exactly", () => {
			const invalid = buying().validate( "purchaseCard", alice, {
				cardId: "open",
				payment: { ruby: 3 }
			} );

			assert.include( invalid?.reason ?? "", "does not settle the card exactly" );
		} );

		it( "accepts gold covering the shortfall", () => {
			assert.isUndefined( buying().validate( "purchaseCard", alice, {
				cardId: "open",
				payment: { ruby: 1, gold: 1 }
			} ) );
		} );

		it( "refuses spending tokens the seat does not hold", () => {
			const invalid = buying().validate( "purchaseCard", alice, {
				cardId: "open",
				payment: { onyx: 2 }
			} );

			// Overpaying a gem the card does not want is caught first.
			assert.isDefined( invalid );
		} );

		it( "refuses spending more gold than the seat holds", () => {
			const game = buying( {
				playerData: { [ alice ]: seat( { tokens: tokens( { gold: 1 } ) } ), [ bob ]: seat() }
			} );

			const invalid = game.validate( "purchaseCard", alice, {
				cardId: "open",
				payment: { gold: 2 }
			} );

			assert.include( invalid?.reason ?? "", "do not hold that many gold" );
		} );

		it( "buys off the board, pays the bank, and replaces the card", () => {
			const game = buying();
			game.play( "purchaseCard", alice, { cardId: "open", payment: { ruby: 2 } } );

			const player = game.state.playerData[ alice ]!;
			assert.deepStrictEqual( player.cards.map( item => item.id ), [ "open" ] );
			assert.strictEqual( player.tokens.ruby, 1 );
			assert.strictEqual( player.points, 1 );
			assert.strictEqual( game.state.tokens.ruby, 6, "the gems go back to the bank" );
			assert.deepStrictEqual( game.state.cards[ 1 ].map( item => item.id ), [ "next" ] );
		} );

		it( "buys out of the seat's own reserve without touching the board", () => {
			const game = buying( {
				playerData: {
					[ alice ]: seat( {
						tokens: tokens( { ruby: 3 } ),
						reserved: [ card( { id: "mine", cost: cost( { ruby: 1 } ) } ) ]
					} ),
					[ bob ]: seat()
				}
			} );

			game.play( "purchaseCard", alice, { cardId: "mine", payment: { ruby: 1 } } );

			const player = game.state.playerData[ alice ]!;
			assert.deepStrictEqual( player.cards.map( item => item.id ), [ "mine" ] );
			assert.deepStrictEqual( [ ...player.reserved ], [] );
			assert.deepStrictEqual( game.state.cards[ 1 ].map( item => item.id ), [ "open" ] );
		} );

		it( "prices against the discounts the seat has already bought", () => {
			const game = buying( {
				playerData: {
					[ alice ]: seat( { tokens: tokens(), cards: [ card( { id: "d", bonus: "ruby" } ) ] } ),
					[ bob ]: seat()
				}
			} );

			assert.isDefined( game.validate( "purchaseCard", alice, {
				cardId: "open",
				payment: { ruby: 2 }
			} ) );

			// One ruby bonus knocks the price to one, which alice cannot pay either —
			// but the payment itself is now the right shape.
			const invalid = game.validate( "purchaseCard", alice, {
				cardId: "open",
				payment: { ruby: 1 }
			} );

			assert.include( invalid?.reason ?? "", "do not hold that many ruby" );
		} );
	} );

	describe( "the noble visit", () => {

		const buyable = ( nobles: ReadonlyArray<Noble> ) => at( {
			nobles,
			cards: { 1: [ card( { id: "open", cost: cost() } ) ], 2: [], 3: [] },
			playerData: {
				[ alice ]: seat( { cards: [ card( { id: "a", bonus: "ruby" } ) ] } ),
				[ bob ]: seat()
			}
		} );

		const noble = ( id: string, requires: Partial<Cost> ): Noble => ( {
			id,
			points: 3,
			cost: cost( requires )
		} );

		/** Two rubies bought, and two nobles that will both come for them. */
		const twoWilling = () => at( {
			nobles: [ noble( "n1", { ruby: 2 } ), noble( "n2", { ruby: 1 } ) ],
			playerData: {
				[ alice ]: seat( {
					cards: [ card( { id: "a", bonus: "ruby" } ), card( { id: "b", bonus: "ruby" } ) ]
				} ),
				[ bob ]: seat()
			}
		} );

		it( "awards the only willing noble as part of the purchase", () => {
			// A visit is a consequence of the purchase, not a turn of its own.
			const game = buyable( [ noble( "n1", { ruby: 2 } ), noble( "n2", { onyx: 5 } ) ] );
			game.play( "purchaseCard", alice, { cardId: "open", payment: {} } );

			const player = game.state.playerData[ alice ]!;
			assert.deepStrictEqual( player.nobles.map( item => item.id ), [ "n1" ] );
			assert.strictEqual( player.points, 3 );
			assert.deepStrictEqual( game.state.nobles.map( item => item.id ), [ "n2" ] );
		} );

		it( "awards nothing when no noble is willing", () => {
			const game = buyable( [ noble( "n1", { onyx: 5 } ) ] );
			assert.deepStrictEqual( game.afterMove( alice, "purchaseCard" ), [] );
		} );

		it( "opens a window instead when two are willing", () => {
			// The choice belongs to the player, so the hook asks rather than picks.
			const game = twoWilling();
			const events = game.afterMove( alice, "purchaseCard" );

			assert.deepStrictEqual( tags( events ), [ "swish/ev/InteractionOpened" ] );

			const window = events[ 0 ] as {
				kind: string;
				subject: PlayerId;
				responders: ReadonlyArray<PlayerId>;
				options?: unknown;
			};

			assert.strictEqual( window.kind, SPLENDOR_NOBLE_VISIT );
			assert.strictEqual( window.subject, alice, "it is their kingdom the nobles visit" );
			assert.deepStrictEqual( [ ...window.responders ], [ alice ], "nobody else is asked" );
			assert.isUndefined( window.options, "the kind's own move list will do" );
		} );

		it( "awards nothing alongside the window it opens", () => {
			// One noble visits per turn, and which one is not settled yet.
			const events = twoWilling().afterMove( alice, "purchaseCard" );
			assert.notInclude( tags( events ), "splendor/ev/NobleVisited" );
		} );

		it( "never opens a second window for the move that settles the first", () => {
			// A hook fires for a response as well as a turn action.
			assert.deepStrictEqual( twoWilling().afterMove( alice, "claimNoble" ), [] );
		} );

		it( "never fires for a move that is not a purchase", () => {
			// A hook fires for a response as well as a turn action, and a purchase is
			// the only move that can change a seat's bonuses at all.
			const game = buyable( [ noble( "n1", { ruby: 2 } ) ] );

			assert.deepStrictEqual( game.afterMove( alice, "pickTokens" ), [] );
			assert.deepStrictEqual( game.afterMove( alice, "claimNoble" ), [] );
		} );
	} );

	describe( "claimNoble", () => {

		const noble = ( id: string, requires: Partial<Cost> ): Noble => ( {
			id,
			points: 3,
			cost: cost( requires )
		} );

		const chooser = () => atPosition( SplendorStructure, {
			state: {
				tokens: tokens( { diamond: 4, sapphire: 4, emerald: 4, ruby: 4, onyx: 4, gold: 5 } ),
				cards: { 1: [], 2: [], 3: [] },
				nobles: [ noble( "n1", { ruby: 2 } ), noble( "n2", { ruby: 1 } ) ],
				decks: { 1: [], 2: [], 3: [] },
				playerData: {
					[ alice ]: seat( {
						cards: [ card( { id: "a", bonus: "ruby" } ), card( { id: "b", bonus: "ruby" } ) ]
					} ),
					[ bob ]: seat()
				}
			},
			config: config(),
			context: {
				players: [ alice, bob ],
				currentPlayer: alice,
				turn: 0,
				interactions: [ nobleWindow() ],
				interactionCount: 1
			}
		} );

		it( "accepts a noble the seat qualifies for", () => {
			assert.isUndefined( chooser().validate( "claimNoble", alice, { nobleId: "n1" } ) );
		} );

		it( "refuses a noble that has left the table", () => {
			const invalid = chooser().validate( "claimNoble", alice, { nobleId: "gone" } );
			assert.include( invalid?.reason ?? "", "no longer on the table" );
		} );

		it( "refuses a noble the seat does not qualify for", () => {
			const game = atPosition( SplendorStructure, {
				state: {
					tokens: tokens(),
					cards: { 1: [], 2: [], 3: [] },
					nobles: [ noble( "n1", { onyx: 5 } ) ],
					decks: { 1: [], 2: [], 3: [] },
					playerData: { [ alice ]: seat(), [ bob ]: seat() }
				},
				config: config(),
				context: {
					players: [ alice, bob ],
					currentPlayer: alice,
					turn: 0,
					interactions: [ nobleWindow() ],
					interactionCount: 1
				}
			} );

			const invalid = game.validate( "claimNoble", alice, { nobleId: "n1" } );
			assert.include( invalid?.reason ?? "", "do not meet that noble's requirement" );
		} );

		it( "refuses it outright with no window open", () => {
			// Otherwise it would be a free extra move for any seat whose cards
			// happen to qualify, on a turn it had not earned.
			const game = at( {
				nobles: [ noble( "n1", { ruby: 1 } ) ],
				playerData: {
					[ alice ]: seat( { cards: [ card( { id: "a", bonus: "ruby" } ) ] } ),
					[ bob ]: seat()
				}
			} );

			const invalid = game.validate( "claimNoble", alice, { nobleId: "n1" } );
			assert.include( invalid?.reason ?? "", "only claimed when the table asks you" );
		} );

		it( "takes the chosen noble and leaves the other", () => {
			const game = chooser();
			game.play( "claimNoble", alice, { nobleId: "n2" } );

			assert.deepStrictEqual(
				game.state.playerData[ alice ]?.nobles.map( item => item.id ),
				[ "n2" ]
			);
			assert.deepStrictEqual( game.state.nobles.map( item => item.id ), [ "n1" ] );
		} );
	} );

	describe( "passTurn", () => {

		it( "refuses a seat that still has something to do", () => {
			const invalid = at().validate( "passTurn", alice, {} );
			assert.include( invalid?.reason ?? "", "still have a legal move" );
		} );

		it( "allows it once the rules leave nothing", () => {
			const game = at( {
				tokens: tokens( { gold: 5 } ),
				cards: { 1: [], 2: [], 3: [] }
			} );

			assert.isUndefined( game.validate( "passTurn", alice, {} ) );
		} );

		it( "emits nothing — the commit is the turn tail alone", () => {
			const game = at( { tokens: tokens( { gold: 5 } ), cards: { 1: [], 2: [], 3: [] } } );
			assert.deepStrictEqual( game.execute( "passTurn", alice, {} ), [] );
		} );
	} );

	describe( "endIf", () => {

		const scored = ( points: number ) => seat( { points } );

		it( "does not end mid-round, however far ahead a seat is", () => {
			// A seat reaching the target mid-round fails this until the round comes
			// back round, which is the rule.
			const game = at(
				{ playerData: { [ alice ]: scored( 20 ), [ bob ]: seat() } },
				bob,
				{},
				1
			);

			assert.isFalse( game.endIf() );
		} );

		it( "ends once the round completes with somebody at the target", () => {
			const game = at(
				{ playerData: { [ alice ]: scored( 15 ), [ bob ]: seat() } },
				alice,
				{},
				2
			);

			assert.isTrue( game.endIf() );
		} );

		it( "keeps going when nobody has reached it", () => {
			const game = at(
				{ playerData: { [ alice ]: scored( 14 ), [ bob ]: scored( 14 ) } },
				alice,
				{},
				2
			);

			assert.isFalse( game.endIf() );
		} );

		it( "is safe at start, with the counter at zero and nobody scoring", () => {
			assert.isFalse( at().endIf() );
		} );

		it( "respects a shorter game", () => {
			const game = at(
				{ playerData: { [ alice ]: scored( 10 ), [ bob ]: seat() } },
				alice,
				{ winningPoints: 10 },
				2
			);

			assert.isTrue( game.endIf() );
		} );
	} );

	describe( "the view", () => {

		it( "reduces the decks to counts and never their order", () => {
			// A deck's order is the whole of this game's hidden information.
			const game = at( { decks: { 1: [ card() ], 2: [], 3: [] } } );
			const view = game.view( TableAudience.make( {} ) );

			assert.deepStrictEqual( view.deckCounts, { 1: 1, 2: 0, 3: 0 } );
			assert.notProperty( view, "decks" );
		} );

		it( "publishes reserved cards — they were face up when they were taken", () => {
			const game = at( {
				playerData: {
					[ alice ]: seat( { reserved: [ card( { id: "r" } ) ] } ),
					[ bob ]: seat()
				}
			} );

			assert.deepStrictEqual(
				game.view( TableAudience.make( {} ) ).playerData[ alice ]?.reserved.map( c => c.id ),
				[ "r" ]
			);
		} );

		it( "differs between audiences only by playerId", () => {
			const game = at();
			const table = game.view( TableAudience.make( {} ) );
			const mine = game.view( PlayerAudience.make( { playerId: bob } ) );

			assert.isUndefined( table.playerId );
			assert.strictEqual( mine.playerId, bob );
			assert.deepStrictEqual( { ...table, playerId: bob }, { ...mine } );
		} );
	} );

	describe( "resolveResults", () => {

		it( "ranks on prestige, then on fewer cards", () => {
			const withCards = ( points: number, count: number ) => seat( {
				points,
				cards: Array.from( { length: count }, ( _, i ) => card( { id: `c${ i }` } ) )
			} );

			const game = at( {
				playerData: { [ alice ]: withCards( 15, 12 ), [ bob ]: withCards( 15, 8 ) }
			} );

			const results = game.results();
			assert.strictEqual( results?.winner, bob );
			assert.deepStrictEqual(
				results?.ranking.map( entry => [ entry.playerId, entry.rank ] ),
				[ [ bob, 1 ], [ alice, 2 ] ]
			);
		} );
	} );

	describe( "botMove", () => {

		it( "plays only a move the rules would accept", () => {
			const game = at( {
				cards: { 1: [ card( { id: "open", cost: cost( { ruby: 1 } ) } ) ], 2: [], 3: [] },
				playerData: { [ alice ]: seat( { tokens: tokens( { ruby: 2 } ) } ), [ bob ]: seat() }
			} );

			const choice = game.bot( PlayerAudience.make( { playerId: alice } ) );
			assert.isDefined( choice );
			assert.isUndefined(
				game.validate( choice!.moveType as "pickTokens", alice, choice!.input as never )
			);
		} );
	} );
} );
