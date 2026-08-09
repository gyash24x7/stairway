import { describe, expect, it } from "bun:test";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
	ChannelNotFound,
	ChatBody,
	ChatFrame,
	ChatMessage,
	ChatReaction,
	ChatText,
	MAX_MESSAGE_LENGTH,
	MessageNotAllowed,
	REACTION_KEYS,
	REACTIONS,
	TooManyMessages
} from "@/chat/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";

const decodeBody = Schema.decodeUnknownOption( ChatBody );

describe( "ChatBody — text", () => {
	it( "accepts a message inside the length bounds", () => {
		const body = { _tag: "chat/Text", text: "well played" } as const;
		expect( decodeBody( body ) ).toEqual( Option.some( body ) );
	} );

	it( "accepts a message of exactly the maximum length", () => {
		const body = { _tag: "chat/Text", text: "x".repeat( MAX_MESSAGE_LENGTH ) };
		expect( Option.isSome( decodeBody( body ) ) ).toBe( true );
	} );

	it( "rejects an empty message", () => {
		expect( Option.isNone( decodeBody( { _tag: "chat/Text", text: "" } ) ) ).toBe( true );
	} );

	it( "rejects a message over the maximum length", () => {
		const body = { _tag: "chat/Text", text: "x".repeat( MAX_MESSAGE_LENGTH + 1 ) };
		expect( Option.isNone( decodeBody( body ) ) ).toBe( true );
	} );
} );

describe( "ChatBody — reactions", () => {
	it( "accepts every key in the palette", () => {
		for ( const key of REACTION_KEYS ) {
			const body = { _tag: "chat/Reaction", key } as const;
			expect( decodeBody( body ) ).toEqual( Option.some( body ) );
		}
	} );

	// The closed vocabulary is what makes a reactions-only channel meaningfully
	// restricted — if arbitrary glyphs decoded, it would just be a text channel.
	it( "rejects any key outside the palette", () => {
		for ( const bad of [ "🔥", "shrug", "", "LIKE", null, 1 ] ) {
			expect( Option.isNone( decodeBody( { _tag: "chat/Reaction", key: bad } ) ) ).toBe( true );
		}
	} );

	it( "rejects a body with an unknown tag", () => {
		expect( Option.isNone( decodeBody( { _tag: "chat/Sticker", key: "like" } ) ) ).toBe( true );
	} );
} );

describe( "REACTIONS palette", () => {
	it( "renders exactly the keys the API accepts", () => {
		expect( REACTIONS.map( r => r.key ) ).toEqual( [ ...REACTION_KEYS ] );
	} );

	it( "gives every entry a distinct glyph", () => {
		expect( new Set( REACTIONS.map( r => r.glyph ) ).size ).toBe( REACTIONS.length );
	} );
} );

describe( "constructors", () => {
	const author = PlayerInfo.make( {
		id: PlayerId.make( "p1" ),
		name: "Ada Lovelace",
		avatar: "https://example.test/a.png",
		isBot: false
	} );

	it( "builds a text message and wraps it in a socket frame", () => {
		const message = ChatMessage.make( {
			id: "m1",
			at: 1_700_000_000_000,
			author,
			body: ChatText.make( { text: "well played" } )
		} );

		expect( message.body ).toEqual( { _tag: "chat/Text", text: "well played" } );
		expect( ChatFrame.make( { message } ) ).toEqual( { _tag: "chat/Frame", message } );
	} );

	it( "builds a reaction message", () => {
		const body = ChatReaction.make( { key: "like" } );
		expect( body ).toEqual( { _tag: "chat/Reaction", key: "like" } );
	} );
} );

describe( "errors", () => {
	it( "carries the status codes the client narrows on", () => {
		expect( new ChannelNotFound( { channelId: "nope" } )._tag ).toBe( "chat/ChannelNotFound" );
		expect( new MessageNotAllowed( { reason: "text off" } )._tag ).toBe( "chat/MessageNotAllowed" );
		expect( new TooManyMessages()._tag ).toBe( "chat/TooManyMessages" );
	} );
} );

