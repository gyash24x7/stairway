import { describe, expect, test } from "bun:test";

import { UserId } from "@/auth/shared/schema.ts";
import { decideNotice } from "@/swish/server/notify.ts";
import { GameId, PlayerId } from "@/swish/shared/schema.ts";

import type { NoticeState } from "@/swish/server/notify.ts";
import type { GameContext, GameHeader, GameStatus, Roster } from "@/swish/shared/schema.ts";

/**
 * `decideNotice` is the whole anti-spam story for push notifications: the
 * engine republishes views constantly, and every one of those republishes runs
 * through here. The rules it enforces — only on a real handover, never to a
 * seat nobody is waiting on, never to someone already looking at the game — are
 * what stand between "it's your turn" and a phone that buzzes on every chat
 * message.
 */

const alice = PlayerId.make( "alice" );
const bob = PlayerId.make( "bob" );
const botly = PlayerId.make( "botly" );

const roster = ( overrides: Partial<Record<string, { isBot?: boolean }>> = {} ) => ( {
	[ alice ]: { id: alice, name: "Alice", avatar: "a", ...overrides[ alice ] },
	[ bob ]: { id: bob, name: "Bob", avatar: "b", ...overrides[ bob ] }
} as unknown as Roster );

const context = ( currentPlayer: PlayerId, interactions: GameContext[ "interactions" ] = [] ) =>
	( {
		players: [ alice, bob ],
		currentPlayer,
		seats: {},
		interactions
	} as unknown as GameContext );

const header = ( over: {
	status?: GameStatus;
	currentPlayer?: PlayerId;
	players?: Roster;
	interactions?: GameContext[ "interactions" ];
} = {} ) => ( {
	id: GameId.make( "game-1" ),
	code: "ABCDEF",
	version: 1,
	players: over.players ?? roster(),
	status: over.status ?? "IN_PROGRESS",
	context: context( over.currentPlayer ?? alice, over.interactions )
} as unknown as GameHeader );

const inProgress: NoticeState = { status: "IN_PROGRESS", actor: bob };
const nobodyConnected = new Set<UserId>();

describe( "decideNotice", () => {

	test( "notifies the new actor when the turn changes hands", () => {
		const result = decideNotice( inProgress, header(), {}, nobodyConnected );

		expect( result.notice?.kind ).toBe( "turn" );
		expect( result.notice?.recipients ).toEqual( [ UserId.make( "alice" ) ] );
		expect( result.state.actor ).toBe( alice );
	} );

	test( "stays silent when the same actor is republished", () => {
		// The engine rebroadcasts on plenty of things that are not handovers — a
		// chat message, an autoplay toggle. None of them should buzz a phone.
		const previous: NoticeState = { status: "IN_PROGRESS", actor: alice };
		const result = decideNotice( previous, header(), {}, nobodyConnected );

		expect( result.notice ).toBeUndefined();
		expect( result.state.actor ).toBe( alice );
	} );

	test( "stays silent when the pending actor is a bot", () => {
		const players = {
			...roster(),
			[ botly ]: { id: botly, name: "Botly", avatar: "c", isBot: true }
		} as unknown as Roster;

		const result = decideNotice(
			inProgress,
			header( { players, currentPlayer: botly } ),
			{},
			nobodyConnected
		);

		expect( result.notice ).toBeUndefined();
	} );

	test( "stays silent when the pending actor handed their seat to the bot policy", () => {
		const result = decideNotice(
			inProgress,
			header(),
			{ [ alice ]: true },
			nobodyConnected
		);

		expect( result.notice ).toBeUndefined();
	} );

	test( "stays silent when the pending actor already has the game open", () => {
		const result = decideNotice(
			inProgress,
			header(),
			{},
			new Set( [ UserId.make( "alice" ) ] )
		);

		expect( result.notice ).toBeUndefined();
	} );

	test( "announces the start to every human who is not watching", () => {
		const previous: NoticeState = { status: "PLAYERS_READY" };
		const result = decideNotice( previous, header(), {}, nobodyConnected );

		expect( result.notice?.kind ).toBe( "start" );
		expect( [ ...result.notice?.recipients ?? [] ].sort() )
			.toEqual( [ UserId.make( "alice" ), UserId.make( "bob" ) ] );
	} );

	test( "announces the start with no prior state at all", () => {
		const result = decideNotice( undefined, header(), {}, nobodyConnected );
		expect( result.notice?.kind ).toBe( "start" );
	} );

	test( "excludes bots and connected players from the start announcement", () => {
		const players = {
			...roster(),
			[ botly ]: { id: botly, name: "Botly", avatar: "c", isBot: true }
		} as unknown as Roster;

		const result = decideNotice(
			{ status: "CREATED" },
			header( { players } ),
			{},
			new Set( [ UserId.make( "bob" ) ] )
		);

		expect( result.notice?.recipients ).toEqual( [ UserId.make( "alice" ) ] );
	} );

	test( "says nothing once the game is completed, and forgets the actor", () => {
		const result = decideNotice(
			inProgress,
			header( { status: "COMPLETED" } ),
			{},
			nobodyConnected
		);

		expect( result.notice ).toBeUndefined();
		expect( result.state ).toEqual( { status: "COMPLETED" } );
	} );

	test( "says nothing before the game is in progress", () => {
		const result = decideNotice(
			{ status: "CREATED" },
			header( { status: "PLAYERS_READY" } ),
			{},
			nobodyConnected
		);

		expect( result.notice ).toBeUndefined();
	} );

	test( "waits on the first unanswered responder while an interaction is open", () => {
		// With a frame open the game is waiting on a responder, not on
		// `currentPlayer` — the notice has to follow the same rule the engine does.
		const interactions = [ {
			kind: "bid",
			initiator: alice,
			responders: [ bob, alice ],
			responses: {}
		} ] as unknown as GameContext[ "interactions" ];

		const result = decideNotice(
			{ status: "IN_PROGRESS", actor: alice },
			header( { currentPlayer: alice, interactions } ),
			{},
			nobodyConnected
		);

		expect( result.notice?.recipients ).toEqual( [ UserId.make( "bob" ) ] );
	} );

	test( "does not re-notify a player who acts twice in a row", () => {
		// This is the "don't notify whoever just moved" rule, which is not written
		// anywhere: the actor simply does not change, so nothing fires.
		const first = decideNotice( inProgress, header(), {}, nobodyConnected );
		expect( first.notice?.kind ).toBe( "turn" );

		const second = decideNotice( first.state, header(), {}, nobodyConnected );
		expect( second.notice ).toBeUndefined();
	} );

} );
