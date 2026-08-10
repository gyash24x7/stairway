import { describe, expect, it } from "bun:test";

import { admitSocket, type BroadcastSnapshot, frameFor } from "@/platform/do/rules.ts";
import { playerAudience, PlayerId, tableAudience } from "@/shared/swish/schema.ts";

const P1 = "player-1";
const P2 = "player-2";

describe( "admitSocket", () => {
	it( "rejects an unauthenticated table stream with 401", () => {
		// The behaviour change couch mode brought: an absent `?playerId=` used to
		// mean "attach a table audience, no session required".
		expect( admitSocket( null, null ) ).toEqual( { _tag: "reject", status: 401 } );
	} );

	it( "rejects an unauthenticated player stream with 401", () => {
		expect( admitSocket( P1, null ) ).toEqual( { _tag: "reject", status: 401 } );
	} );

	// Nobody attaches to somebody else's private stream.
	it( "rejects a player id that isn't the session's with 403", () => {
		expect( admitSocket( P1, P2 ) ).toEqual( { _tag: "reject", status: 403 } );
	} );

	it( "admits the session's own player id as a player audience", () => {
		const admission = admitSocket( P1, P1 );
		expect( admission ).toEqual( {
			_tag: "admit",
			audience: { _tag: "swish/Player", id: PlayerId.make( P1 ) }
		} );
	} );

	it( "admits a session with no player id as the table audience", () => {
		expect( admitSocket( null, P1 ) ).toEqual( {
			_tag: "admit",
			audience: { _tag: "swish/Table" }
		} );
	} );
} );

describe( "frameFor", () => {
	const snapshot: BroadcastSnapshot = {
		table: { view: "table" },
		playerViews: { [ P1 ]: { view: "p1" } }
	};

	it( "gives a player their own projection", () => {
		expect( frameFor( playerAudience( PlayerId.make( P1 ) ), snapshot ) )
			.toEqual( { view: "p1" } );
	} );

	// A seat with no projection of its own still sees a coherent board.
	it( "falls back to the table view when a player has no projection", () => {
		expect( frameFor( playerAudience( PlayerId.make( P2 ) ), snapshot ) )
			.toEqual( { view: "table" } );
	} );

	// The load-bearing assertion: a table socket can never be handed a player view,
	// whatever `playerViews` happens to contain.
	it( "gives the table audience the table view", () => {
		expect( frameFor( tableAudience(), snapshot ) ).toEqual( { view: "table" } );
	} );
} );
