import { assert, describe, it } from "@effect/vitest";

import { atPosition } from "@tests/harness/position";

import type { CoupActionName, CoupCard, CoupState } from "@/games/coup/schema";
import { CoupConfig } from "@/games/coup/schema";
import { CoupStructure } from "@/games/coup/server/engine";
import type { InteractionFrame, PlayerId } from "@/swish/schema";
import {
	InteractionFrame as Frame,
	InteractionOption,
	InteractionResponse,
	PlayerAudience,
	TableAudience
} from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;

const config = CoupConfig.make( {
	playerCount: 3,
	autoStart: true,
	botDelayMillis: 5_000,
	moveTimeoutMillis: 60_000
} );

type Seed = Partial<CoupState> & { readonly current?: PlayerId };

const at = ( { current = alice, ...state }: Seed = {} ) => atPosition( CoupStructure, {
	state: {
		deck: [ "AMBASSADOR", "CONTESSA", "ASSASSIN" ],
		hands: {
			[ alice ]: [ "DUKE", "CAPTAIN" ],
			[ bob ]: [ "CONTESSA", "ASSASSIN" ],
			[ carol ]: [ "AMBASSADOR", "DUKE" ]
		},
		lost: {},
		coins: { [ alice ]: 2, [ bob ]: 2, [ carol ]: 2 },
		eliminated: [],
		drawn: {},
		...state
	},
	config,
	context: { players: [ alice, bob, carol ], currentPlayer: current, turn: 0 }
} );

/** A settled window, as `onResolve` is handed one. */
const frame = ( options: {
	readonly kind: string;
	readonly initiator: PlayerId;
	readonly responders: ReadonlyArray<PlayerId>;
	readonly answer?: { readonly playerId: PlayerId; readonly move: string };
	readonly subject?: PlayerId;
} ): InteractionFrame => Frame.make( {
	id: "frame-1",
	kind: options.kind,
	initiator: options.initiator,
	subject: options.subject,
	responders: options.responders,
	pending: [],
	responses: options.answer
		? [
			InteractionResponse.make( {
				playerId: options.answer.playerId,
				move: options.answer.move,
				outcome: "answered"
			} )
		]
		: options.responders.map( playerId => InteractionResponse.make( {
			playerId,
			outcome: "passed"
		} ) ),
	options: [ InteractionOption.make( { move: "challenge" } ) ],
	resolution: "first",
	allowPass: true,
	secret: false,
	openedAtTurn: 0
} );

const tags = ( events: ReadonlyArray<unknown> ) =>
	events.map( event => ( event as { _tag: string } )._tag );

const pendingAfter = (
	actor: PlayerId,
	action: CoupActionName,
	target?: PlayerId,
	claim?: CoupCard
) => ( {
	_tag: "coup/PendingAction" as const,
	action,
	actor,
	target,
	claim
} );


describe( "coup rules", () => {

	describe( "the forced coup", () => {

		for ( const move of [ "income", "foreignAid", "tax", "exchange" ] as const ) {
			it( `refuses ${ move } at ten coins`, () => {
				const game = at( { coins: { [ alice ]: 10 } } );
				const invalid = game.validate( move, alice, {} );

				assert.strictEqual( invalid?._tag, "swish/InvalidMove" );
				assert.include( invalid?.reason ?? "", "must launch a coup" );
			} );
		}

		it( "refuses a targeted action at ten coins too", () => {
			const game = at( { coins: { [ alice ]: 10, [ bob ]: 2 } } );
			assert.isDefined( game.validate( "steal", alice, { target: bob } ) );
			assert.isDefined( game.validate( "assassinate", alice, { target: bob } ) );
		} );

		it( "still allows the coup itself", () => {
			const game = at( { coins: { [ alice ]: 10, [ bob ]: 2 } } );
			assert.isUndefined( game.validate( "coup", alice, { target: bob } ) );
		} );

		it( "allows everything again at nine", () => {
			const game = at( { coins: { [ alice ]: 9 } } );
			assert.isUndefined( game.validate( "income", alice, {} ) );
		} );
	} );

	describe( "targeting", () => {

		it( "refuses aiming at yourself", () => {
			const game = at( { coins: { [ alice ]: 7 } } );
			const invalid = game.validate( "coup", alice, { target: alice } );
			assert.include( invalid?.reason ?? "", "cannot target yourself" );
		} );

		it( "refuses somebody who is not at the table", () => {
			const game = at( { coins: { [ alice ]: 7 } } );
			const invalid = game.validate( "coup", alice, { target: "mallory" as PlayerId } );
			assert.include( invalid?.reason ?? "", "nobody at this table" );
		} );

		it( "refuses somebody already out", () => {
			const game = at( { coins: { [ alice ]: 7 }, eliminated: [ bob ] } );
			const invalid = game.validate( "coup", alice, { target: bob } );
			assert.include( invalid?.reason ?? "", "already out" );
		} );
	} );

	describe( "income", () => {

		it( "pays one and opens nothing", () => {
			const game = at();
			const events = game.execute( "income", alice, {} );

			assert.deepStrictEqual( tags( events ), [ "coup/ev/CoinsChanged" ] );
			game.apply( ...events );
			assert.strictEqual( game.state.coins[ alice ], 3 );
		} );
	} );

	describe( "coup", () => {

		it( "costs seven", () => {
			const game = at( { coins: { [ alice ]: 6 } } );
			const invalid = game.validate( "coup", alice, { target: bob } );
			assert.include( invalid?.reason ?? "", "costs 7 coins" );
		} );

		it( "spends the coins and asks the target for a card", () => {
			const game = at( { coins: { [ alice ]: 7, [ bob ]: 2 } } );
			const events = game.execute( "coup", alice, { target: bob } );

			assert.deepStrictEqual(
				tags( events ),
				[ "coup/ev/CoinsChanged", "swish/ev/InteractionOpened" ]
			);

			const window = events[ 1 ] as { kind: string; subject: PlayerId; responders: unknown };
			assert.strictEqual( window.kind, "loseInfluence" );
			assert.strictEqual( window.subject, bob );
			assert.deepStrictEqual( window.responders, [ bob ] );
		} );

		it( "declares no pending action — there is nothing to argue about", () => {
			const game = at( { coins: { [ alice ]: 7 } } );
			game.apply( ...game.execute( "coup", alice, { target: bob } ) );
			assert.isUndefined( game.state.pending );
		} );
	} );

	describe( "declaring a claim", () => {

		it( "tax claims a Duke and offers only a challenge", () => {
			const game = at();
			const events = game.execute( "tax", alice, {} );

			game.apply( ...events );
			assert.deepStrictEqual( game.state.pending, pendingAfter( alice, "tax", undefined, "DUKE" ) );

			const window = events[ 1 ] as { options: ReadonlyArray<{ move: string }> };
			assert.deepStrictEqual( window.options.map( o => o.move ), [ "challenge" ] );
		} );

		it( "foreign aid claims nothing and offers only a block", () => {
			const game = at();
			const events = game.execute( "foreignAid", alice, {} );

			game.apply( ...events );
			assert.isUndefined( game.state.pending?.claim );

			const window = events[ 1 ] as { options: ReadonlyArray<{ move: string }> };
			assert.deepStrictEqual( window.options.map( o => o.move ), [ "blockForeignAid" ] );
		} );

		it( "assassinate spends the coins up front, before anyone objects", () => {
			const game = at( { coins: { [ alice ]: 3, [ bob ]: 2, [ carol ]: 2 } } );
			game.apply( ...game.execute( "assassinate", alice, { target: bob } ) );

			assert.strictEqual( game.state.coins[ alice ], 0 );
		} );

		it( "offers the assassination's block to the target alone", () => {
			const game = at( { coins: { [ alice ]: 3, [ bob ]: 2, [ carol ]: 2 } } );
			// The coins go first, then the declaration, then the window.
			const events = game.execute( "assassinate", alice, { target: bob } );
			const window = events[ 2 ] as {
				responders: ReadonlyArray<PlayerId>;
				options: ReadonlyArray<{ move: string; players?: ReadonlyArray<PlayerId> }>;
			};

			// One window, two audiences: everybody may challenge, only bob may block.
			assert.deepStrictEqual( [ ...window.responders ], [ bob, carol ] );
			assert.deepStrictEqual(
				window.options.map( o => [ o.move, o.players ] ),
				[ [ "challenge", undefined ], [ "blockAssassination", [ bob ] ] ]
			);
		} );

		it( "refuses an assassination that cannot be paid for", () => {
			const game = at( { coins: { [ alice ]: 2 } } );
			const invalid = game.validate( "assassinate", alice, { target: bob } );
			assert.include( invalid?.reason ?? "", "costs 3 coins" );
		} );

		it( "refuses a steal from somebody with nothing", () => {
			const game = at( { coins: { [ alice ]: 2, [ bob ]: 0 } } );
			const invalid = game.validate( "steal", alice, { target: bob } );
			assert.include( invalid?.reason ?? "", "nothing to take" );
		} );

		it( "offers the steal's block to the target alone", () => {
			const events = at().execute( "steal", alice, { target: bob } );
			const window = events[ 1 ] as {
				options: ReadonlyArray<{ move: string; players?: ReadonlyArray<PlayerId> }>;
			};

			assert.deepStrictEqual(
				window.options.map( o => [ o.move, o.players ] ),
				[ [ "challenge", undefined ], [ "blockSteal", [ bob ] ] ]
			);
		} );
	} );

	describe( "responses", () => {

		it( "refuses a challenge with nothing open", () => {
			const invalid = at().validate( "challenge", bob, {} );
			assert.include( invalid?.reason ?? "", "nothing to challenge" );
		} );

		it( "refuses blocking foreign aid nobody claimed", () => {
			const invalid = at().validate( "blockForeignAid", bob, {} );
			assert.include( invalid?.reason ?? "", "No foreign aid" );
		} );

		it( "lets only the target claim a Contessa", () => {
			const game = at();
			game.apply( ...game.execute( "assassinate", alice, { target: bob } ) );

			assert.isUndefined( game.validate( "blockAssassination", bob, {} ) );

			const invalid = game.validate( "blockAssassination", carol, {} );
			assert.include( invalid?.reason ?? "", "Only the target" );
		} );

		it( "lets only the target block a steal", () => {
			const game = at();
			game.apply( ...game.execute( "steal", alice, { target: bob } ) );

			assert.isUndefined( game.validate( "blockSteal", bob, { claim: "CAPTAIN" } ) );
			assert.isDefined( game.validate( "blockSteal", carol, { claim: "CAPTAIN" } ) );
		} );

		it( "records which character a steal was blocked with", () => {
			const game = at();
			game.apply( ...game.execute( "steal", alice, { target: bob } ) );
			game.apply( ...game.execute( "blockSteal", bob, { claim: "AMBASSADOR" } ) );

			assert.strictEqual( game.state.pending?.blocker, bob );
			assert.strictEqual( game.state.pending?.blockClaim, "AMBASSADOR" );
		} );
	} );

	describe( "reveal", () => {

		it( "refuses a card you are not holding", () => {
			const invalid = at().validate( "reveal", alice, { card: "CONTESSA" } );
			assert.include( invalid?.reason ?? "", "not holding that card" );
		} );

		it( "takes the card, hides it, and puts it back in the deck", () => {
			const game = at();
			const before = game.state.deck.length;

			game.apply( ...game.execute( "reveal", alice, { card: "DUKE" } ) );

			assert.deepStrictEqual( [ ...game.state.hands[ alice ]! ], [ "CAPTAIN" ] );
			assert.deepStrictEqual( [ ...game.state.lost[ alice ]! ], [ "DUKE" ] );
			assert.strictEqual( game.state.deck.length, before + 1 );
			assert.include( [ ...game.state.deck ], "DUKE" );
		} );

		it( "knocks a player out when it was their last card", () => {
			const game = at( { hands: { [ alice ]: [ "DUKE" ] } } );
			const events = game.execute( "reveal", alice, { card: "DUKE" } );

			assert.deepStrictEqual(
				tags( events ),
				[ "coup/ev/InfluenceLost", "coup/ev/PlayerEliminated" ]
			);

			game.apply( ...events );
			assert.deepStrictEqual( [ ...game.state.eliminated ], [ alice ] );
		} );

		it( "takes exactly one of a matched pair", () => {
			const game = at( { hands: { [ alice ]: [ "DUKE", "DUKE" ] } } );
			game.apply( ...game.execute( "reveal", alice, { card: "DUKE" } ) );

			assert.deepStrictEqual( [ ...game.state.hands[ alice ]! ], [ "DUKE" ] );
			assert.deepStrictEqual( [ ...game.state.eliminated ], [] );
		} );
	} );

	describe( "exchangeReturn", () => {

		const drawing = () => at( {
			hands: { [ alice ]: [ "DUKE", "CAPTAIN" ] },
			drawn: { [ alice ]: [ "CONTESSA", "ASSASSIN" ] }
		} );

		it( "keeps exactly as many as you had", () => {
			const invalid = drawing().validate( "exchangeReturn", alice, { cards: [ "DUKE" ] } );
			assert.include( invalid?.reason ?? "", "exactly 2 card(s)" );
		} );

		it( "refuses cards that are not in front of you", () => {
			const invalid = drawing().validate(
				"exchangeReturn",
				alice,
				{ cards: [ "AMBASSADOR", "DUKE" ] }
			);

			assert.include( invalid?.reason ?? "", "not in front of you" );
		} );

		it( "refuses keeping two of a card only one copy of which is in front of you", () => {
			const invalid = drawing().validate(
				"exchangeReturn",
				alice,
				{ cards: [ "DUKE", "DUKE" ] }
			);

			assert.isDefined( invalid );
		} );

		it( "swaps the hand and puts the rest back", () => {
			const game = drawing();
			const before = game.state.deck.length;

			game.apply( ...game.execute(
				"exchangeReturn",
				alice,
				{ cards: [ "CONTESSA", "ASSASSIN" ] }
			) );

			assert.deepStrictEqual( [ ...game.state.hands[ alice ]! ], [ "CONTESSA", "ASSASSIN" ] );
			assert.deepStrictEqual( [ ...game.state.drawn[ alice ]! ], [] );
			assert.strictEqual( game.state.deck.length, before + 2 );
		} );

		it( "lets you keep what you already had", () => {
			const game = drawing();
			assert.isUndefined(
				game.validate( "exchangeReturn", alice, { cards: [ "DUKE", "CAPTAIN" ] } )
			);
		} );
	} );

	describe( "the claim window resolving", () => {

		it( "lets the action through when nobody objects", () => {
			const game = at();
			game.apply( ...game.execute( "tax", alice, {} ) );

			const events = game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ bob, carol ]
			} ) );

			assert.deepStrictEqual(
				tags( events ),
				[ "coup/ev/CoinsChanged", "coup/ev/ActionResolved" ]
			);

			game.apply( ...events );
			assert.strictEqual( game.state.coins[ alice ], 5 );
			assert.isUndefined( game.state.pending );
		} );

		it( "costs the challenger a card when the claim is proven", () => {
			// Alice really does hold the Duke she claimed.
			const game = at();
			game.apply( ...game.execute( "tax", alice, {} ) );

			const events = game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ bob, carol ],
				answer: { playerId: bob, move: "challenge" }
			} ) );

			// The card is shown, swapped for a fresh one, bob pays, and the tax stands.
			assert.deepStrictEqual( tags( events ), [
				"coup/ev/CardReplaced",
				"swish/ev/InteractionOpened",
				"coup/ev/CoinsChanged",
				"coup/ev/ActionResolved"
			] );

			const window = events[ 1 ] as { kind: string; subject: PlayerId };
			assert.strictEqual( window.kind, "loseInfluence" );
			assert.strictEqual( window.subject, bob );
		} );

		it( "replaces the proven card rather than leaving it on show", () => {
			const game = at();
			game.apply( ...game.execute( "tax", alice, {} ) );
			game.apply( ...game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ bob, carol ],
				answer: { playerId: bob, move: "challenge" }
			} ) ) );

			const hand = game.state.hands[ alice ]!;
			assert.strictEqual( hand.length, 2, "the hand is the same size" );
			assert.include( [ ...hand ], "CAPTAIN", "the untouched card is still there" );
		} );

		it( "costs the bluffer a card and throws the action out", () => {
			// Bob claims a Duke he does not hold.
			const game = at( { current: bob } );
			game.apply( ...game.execute( "tax", bob, {} ) );

			const events = game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: bob,
				responders: [ alice, carol ],
				answer: { playerId: alice, move: "challenge" }
			} ) );

			assert.deepStrictEqual(
				tags( events ),
				[ "swish/ev/InteractionOpened", "coup/ev/ActionCancelled" ]
			);

			const window = events[ 0 ] as { subject: PlayerId };
			assert.strictEqual( window.subject, bob, "the bluffer pays, not the challenger" );

			game.apply( ...events );
			assert.strictEqual( game.state.coins[ bob ], 2, "and the tax never happens" );
		} );

		it( "opens a second window over a block rather than settling it", () => {
			const game = at();
			game.apply( ...game.execute( "foreignAid", alice, {} ) );
			game.apply( ...game.execute( "blockForeignAid", bob, {} ) );

			const events = game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ bob, carol ],
				answer: { playerId: bob, move: "blockForeignAid" }
			} ) );

			assert.deepStrictEqual( tags( events ), [ "swish/ev/InteractionOpened" ] );

			const window = events[ 0 ] as {
				kind: string;
				initiator: PlayerId;
				responders: ReadonlyArray<PlayerId>;
			};

			assert.strictEqual( window.kind, "blockClaim" );
			assert.strictEqual( window.initiator, bob );
			assert.deepStrictEqual( [ ...window.responders ], [ alice, carol ] );
		} );

		it( "takes what is there when a steal is aimed at one coin", () => {
			const game = at( { coins: { [ alice ]: 2, [ bob ]: 1, [ carol ]: 2 } } );
			game.apply( ...game.execute( "steal", alice, { target: bob } ) );
			game.apply( ...game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ bob, carol ]
			} ) ) );

			assert.strictEqual( game.state.coins[ bob ], 0 );
			assert.strictEqual( game.state.coins[ alice ], 3 );
		} );

		it( "draws for an exchange and asks the actor what to keep", () => {
			const game = at();
			game.apply( ...game.execute( "exchange", alice, {} ) );

			const events = game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ bob, carol ]
			} ) );

			assert.deepStrictEqual( tags( events ), [
				"coup/ev/ExchangeDrawn",
				"coup/ev/ActionResolved",
				"swish/ev/InteractionOpened"
			] );

			game.apply( ...events );
			assert.strictEqual( game.state.drawn[ alice ]?.length, 2 );
		} );

		it( "draws only what the deck can offer", () => {
			const game = at( { deck: [ "DUKE" ] } );
			game.apply( ...game.execute( "exchange", alice, {} ) );
			game.apply( ...game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ bob, carol ]
			} ) ) );

			assert.strictEqual( game.state.drawn[ alice ]?.length, 1 );
			assert.strictEqual( game.state.deck.length, 0 );
		} );

		it( "asks the assassination's target for a card once it stands", () => {
			const game = at( { coins: { [ alice ]: 3, [ bob ]: 2, [ carol ]: 2 } } );
			game.apply( ...game.execute( "assassinate", alice, { target: bob } ) );

			const events = game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ bob, carol ]
			} ) );

			assert.deepStrictEqual(
				tags( events ),
				[ "coup/ev/ActionResolved", "swish/ev/InteractionOpened" ]
			);

			assert.strictEqual( ( events[ 1 ] as { subject: PlayerId } ).subject, bob );
		} );

		it( "does not ask a target who is already out", () => {
			const game = at( {
				coins: { [ alice ]: 3, [ bob ]: 2, [ carol ]: 2 },
				eliminated: [ bob ]
			} );

			game.apply( ...game.execute( "assassinate", alice, { target: bob } ) );
			const events = game.onResolve( "claim", frame( {
				kind: "claim",
				initiator: alice,
				responders: [ carol ]
			} ) );

			assert.deepStrictEqual( tags( events ), [ "coup/ev/ActionResolved" ] );
		} );
	} );

	describe( "the block window resolving", () => {

		/** Foreign aid declared, blocked by bob claiming a Duke. */
		const blocked = ( blocker: PlayerId = bob ) => {
			const game = at();
			game.apply( ...game.execute( "foreignAid", alice, {} ) );
			game.apply( ...game.execute( "blockForeignAid", blocker, {} ) );
			return game;
		};

		it( "throws the action out when nobody challenges the block", () => {
			const game = blocked();
			const events = game.onResolve( "blockClaim", frame( {
				kind: "blockClaim",
				initiator: bob,
				responders: [ alice, carol ]
			} ) );

			assert.deepStrictEqual( tags( events ), [ "coup/ev/ActionCancelled" ] );

			game.apply( ...events );
			assert.strictEqual( game.state.coins[ alice ], 2, "no aid was paid" );
		} );

		it( "still throws it out when the block is challenged and proven", () => {
			// Carol holds a Duke, so her block stands and alice pays for doubting it.
			const game = blocked( carol );
			const events = game.onResolve( "blockClaim", frame( {
				kind: "blockClaim",
				initiator: carol,
				responders: [ alice, bob ],
				answer: { playerId: alice, move: "challenge" }
			} ) );

			assert.deepStrictEqual( tags( events ), [
				"coup/ev/CardReplaced",
				"swish/ev/InteractionOpened",
				"coup/ev/ActionCancelled"
			] );

			assert.strictEqual( ( events[ 1 ] as { subject: PlayerId } ).subject, alice );
		} );

		it( "lets the action through when the block is caught as a bluff", () => {
			// Bob has no Duke. His block collapses and the aid is paid after all.
			const game = blocked( bob );
			const events = game.onResolve( "blockClaim", frame( {
				kind: "blockClaim",
				initiator: bob,
				responders: [ alice, carol ],
				answer: { playerId: alice, move: "challenge" }
			} ) );

			assert.deepStrictEqual( tags( events ), [
				"swish/ev/InteractionOpened",
				"coup/ev/CoinsChanged",
				"coup/ev/ActionResolved"
			] );

			assert.strictEqual(
				( events[ 0 ] as { subject: PlayerId } ).subject,
				bob,
				"the caught blocker pays"
			);

			game.apply( ...events );
			assert.strictEqual( game.state.coins[ alice ], 4, "and the aid is paid" );
		} );
	} );

	describe( "the loseInfluence window resolving", () => {

		it( "leaves an answered responder alone", () => {
			const game = at();
			const events = game.onResolve( "loseInfluence", frame( {
				kind: "loseInfluence",
				initiator: alice,
				subject: bob,
				responders: [ bob ],
				answer: { playerId: bob, move: "reveal" }
			} ) );

			assert.deepStrictEqual( events, [] );
		} );

		it( "takes the leftmost card from a responder who never answered", () => {
			const game = at();
			const events = game.onResolve( "loseInfluence", frame( {
				kind: "loseInfluence",
				initiator: alice,
				subject: bob,
				responders: [ bob ]
			} ) );

			assert.deepStrictEqual( tags( events ), [ "coup/ev/InfluenceLost" ] );
			assert.strictEqual( ( events[ 0 ] as { card: string } ).card, "CONTESSA" );
		} );

		it( "threads the deck across two responders, losing neither card", () => {
			const game = at();
			const events = game.onResolve( "loseInfluence", frame( {
				kind: "loseInfluence",
				initiator: alice,
				responders: [ bob, carol ]
			} ) );

			assert.deepStrictEqual(
				tags( events ),
				[ "coup/ev/InfluenceLost", "coup/ev/InfluenceLost" ]
			);

			// The second reshuffle has to build on the pile the first one left, or
			// bob's card silently vanishes from the game.
			const second = events[ 1 ] as { deck: ReadonlyArray<string> };
			assert.strictEqual( second.deck.length, game.state.deck.length + 2 );
			assert.include( [ ...second.deck ], "CONTESSA" );
			assert.include( [ ...second.deck ], "AMBASSADOR" );
		} );

		it( "skips a responder with nothing left to give", () => {
			// The awkward case: a challenger who is also the assassination target has
			// already lost their last card to the challenge.
			const game = at( { hands: { [ alice ]: [ "DUKE" ], [ bob ]: [] } } );
			const events = game.onResolve( "loseInfluence", frame( {
				kind: "loseInfluence",
				initiator: alice,
				responders: [ bob ]
			} ) );

			assert.deepStrictEqual( events, [] );
		} );

		it( "knocks out a responder whose last card it takes", () => {
			const game = at( { hands: { [ bob ]: [ "CONTESSA" ] } } );
			const events = game.onResolve( "loseInfluence", frame( {
				kind: "loseInfluence",
				initiator: alice,
				responders: [ bob ]
			} ) );

			assert.deepStrictEqual(
				tags( events ),
				[ "coup/ev/InfluenceLost", "coup/ev/PlayerEliminated" ]
			);
		} );
	} );

	describe( "the exchange window resolving", () => {

		it( "gives the draw back when the player never chose", () => {
			const game = at( { drawn: { [ alice ]: [ "CONTESSA", "ASSASSIN" ] } } );
			const before = game.state.deck.length;

			const events = game.onResolve( "exchange", frame( {
				kind: "exchange",
				initiator: alice,
				subject: alice,
				responders: [ alice ]
			} ) );

			game.apply( ...events );
			assert.deepStrictEqual( [ ...game.state.hands[ alice ]! ], [ "DUKE", "CAPTAIN" ] );
			assert.deepStrictEqual( [ ...game.state.drawn[ alice ]! ], [] );
			assert.strictEqual( game.state.deck.length, before + 2 );
		} );

		it( "does nothing when there is no draw in front of anyone", () => {
			const events = at().onResolve( "exchange", frame( {
				kind: "exchange",
				initiator: alice,
				subject: alice,
				responders: [ alice ]
			} ) );

			assert.deepStrictEqual( events, [] );
		} );
	} );

	describe( "turn order", () => {

		it( "goes round the table", () => {
			assert.strictEqual( at().nextPlayer( alice, "income" ), bob );
			assert.strictEqual( at().nextPlayer( carol, "income" ), alice );
		} );

		it( "steps over somebody who is out", () => {
			const game = at( { eliminated: [ bob ] } );
			assert.strictEqual( game.nextPlayer( alice, "income" ), carol );
		} );

		it( "stays put when nobody else is left", () => {
			const game = at( { eliminated: [ bob, carol ] } );
			assert.strictEqual( game.nextPlayer( alice, "income" ), alice );
		} );
	} );

	describe( "ending", () => {

		it( "runs while two are left", () => {
			assert.isFalse( at( { eliminated: [ bob ] } ).endIf() );
		} );

		it( "ends when one is left", () => {
			assert.isTrue( at( { eliminated: [ bob, carol ] } ).endIf() );
		} );

		it( "ranks the survivor first and the rest in reverse order of going out", () => {
			const results = at( { eliminated: [ bob, carol ] } ).results();

			assert.strictEqual( results?.winner, alice );
			assert.deepStrictEqual(
				results?.ranking.map( entry => [ entry.playerId, entry.rank ] ),
				[ [ alice, 1 ], [ carol, 2 ], [ bob, 3 ] ]
			);
		} );
	} );

	describe( "the view", () => {

		it( "shows a seat its own hand and nobody else's", () => {
			const game = at();
			const mine = game.view( PlayerAudience.make( { playerId: alice } ) );

			assert.deepStrictEqual( [ ...mine.hand ], [ "DUKE", "CAPTAIN" ] );
			assert.deepStrictEqual( mine.influence, { [ alice ]: 2, [ bob ]: 2, [ carol ]: 2 } );
		} );

		it( "gives the table a count and no cards at all", () => {
			const table = at().view( TableAudience.make( {} ) );

			assert.deepStrictEqual( [ ...table.hand ], [] );
			assert.isUndefined( table.playerId );
			assert.deepStrictEqual( table.influence, { [ alice ]: 2, [ bob ]: 2, [ carol ]: 2 } );
		} );

		it( "shows a seat only its own losses", () => {
			const game = at( { lost: { [ alice ]: [ "DUKE" ], [ bob ]: [ "CONTESSA" ] } } );

			const mine = game.view( PlayerAudience.make( { playerId: alice } ) );
			assert.deepStrictEqual( [ ...mine.lost ], [ "DUKE" ] );

			const theirs = game.view( PlayerAudience.make( { playerId: carol } ) );
			assert.deepStrictEqual( [ ...theirs.lost ], [] );
		} );

		it( "publishes the deck's size but never its cards", () => {
			const table = at().view( TableAudience.make( {} ) );
			assert.strictEqual( table.deckSize, 3 );
			assert.notProperty( table, "deck" );
		} );

		it( "publishes the pending claim — that is what makes it challengeable", () => {
			const game = at();
			game.apply( ...game.execute( "tax", alice, {} ) );

			const table = game.view( TableAudience.make( {} ) );
			assert.strictEqual( table.pending?.claim, "DUKE" );
			assert.strictEqual( table.pending?.actor, alice );
		} );

		it( "keeps an exchange draw to the seat it was dealt to", () => {
			const game = at( { drawn: { [ alice ]: [ "CONTESSA" ] } } );

			assert.deepStrictEqual(
				[ ...game.view( PlayerAudience.make( { playerId: alice } ) ).drawn ],
				[ "CONTESSA" ]
			);
			assert.deepStrictEqual(
				[ ...game.view( PlayerAudience.make( { playerId: bob } ) ).drawn ],
				[]
			);
		} );
	} );
} );
