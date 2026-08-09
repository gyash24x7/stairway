import { describe, expect, it } from "bun:test";

import {
	admitMessage,
	KEY_MSG_PREFIX,
	messageKey,
	RATE_LIMIT_MESSAGES,
	RATE_LIMIT_WINDOW_MS
} from "@/chat/server/rules.ts";
import { isBodyAllowed } from "@/chat/server/rules.ts";
import type { ChatBody } from "@/chat/shared/schema.ts";

const text: ChatBody = { _tag: "chat/Text", text: "hello" };
const reaction: ChatBody = { _tag: "chat/Reaction", key: "like" };

const open = { text: true, reactions: true };
/** What every fish channel is created with. */
const reactionsOnly = { text: false, reactions: true };

describe( "isBodyAllowed", () => {
	it( "allows both kinds on an open channel", () => {
		expect( isBodyAllowed( open, text ) ).toBe( true );
		expect( isBodyAllowed( open, reaction ) ).toBe( true );
	} );

	// The whole point of the fish policy — and the only thing enforcing it.
	it( "rejects text but allows reactions on a reactions-only channel", () => {
		expect( isBodyAllowed( reactionsOnly, text ) ).toBe( false );
		expect( isBodyAllowed( reactionsOnly, reaction ) ).toBe( true );
	} );

	it( "rejects reactions when the policy disables them", () => {
		const noReactions = { text: true, reactions: false };
		expect( isBodyAllowed( noReactions, reaction ) ).toBe( false );
		expect( isBodyAllowed( noReactions, text ) ).toBe( true );
	} );
} );

describe( "messageKey", () => {
	it( "carries the prefix `history` lists on", () => {
		expect( messageKey( 0 ).startsWith( KEY_MSG_PREFIX ) ).toBe( true );
	} );

	// Without the zero padding `msg:10` sorts before `msg:9` and the backlog
	// comes back out of order.
	it( "sorts lexicographically in sequence order across digit widths", () => {
		const keys = [ 0, 1, 9, 10, 99, 100, 1_000, 123_456 ].map( messageKey );
		expect( [ ...keys ].sort() ).toEqual( keys );
	} );
} );

describe( "admitMessage", () => {
	it( "admits up to the limit inside one window", () => {
		let recent: ReadonlyArray<number> = [];
		for ( let i = 0; i < RATE_LIMIT_MESSAGES; i++ ) {
			const admission = admitMessage( recent, 1_000 + i );
			expect( admission.allowed ).toBe( true );
			recent = admission.recent;
		}

		expect( recent.length ).toBe( RATE_LIMIT_MESSAGES );
	} );

	it( "rejects the message past the limit", () => {
		const recent = Array.from( { length: RATE_LIMIT_MESSAGES }, ( _, i ) => 1_000 + i );
		expect( admitMessage( recent, 1_100 ).allowed ).toBe( false );
	} );

	// A rejected post must not append its own timestamp, or hammering a full
	// window would keep pushing the ban out indefinitely.
	it( "does not extend the window on a rejected message", () => {
		const recent = Array.from( { length: RATE_LIMIT_MESSAGES }, ( _, i ) => 1_000 + i );
		expect( admitMessage( recent, 1_100 ).recent ).toEqual( recent );
	} );

	it( "admits again once the window has rolled past", () => {
		const recent = Array.from( { length: RATE_LIMIT_MESSAGES }, ( _, i ) => 1_000 + i );
		const admission = admitMessage( recent, 1_000 + RATE_LIMIT_WINDOW_MS );
		expect( admission.allowed ).toBe( true );
		// The first timestamp has aged out; the rest plus `now` are kept.
		expect( admission.recent.length ).toBe( RATE_LIMIT_MESSAGES );
	} );

	it( "prunes stale timestamps entirely", () => {
		const admission = admitMessage( [ 1, 2, 3 ], 1_000_000 );
		expect( admission.allowed ).toBe( true );
		expect( admission.recent ).toEqual( [ 1_000_000 ] );
	} );
} );
