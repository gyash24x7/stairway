import type { LitPlayer } from "@prisma/client";
import { CardRank, CardSuit, PlayingCard } from "@s2h/cards";
import { EnhancedLitPlayer, LiteraturePlayer } from "@s2h/literature/utils";
import { createId as cuid } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

describe( "Enhanced Lit Player", function () {

	const litPlayer: LitPlayer = {
		id: cuid(),
		name: "Player Name",
		hand: { cards: [ { rank: "Two", suit: "Diamonds" }, { rank: "Two", suit: "Clubs" } ] },
		avatar: "avatar_url",
		gameId: cuid(),
		teamId: cuid(),
		userId: cuid()
	};

	it( "should serialize and deserialize correctly", function () {
		const enhancedPlayer = EnhancedLitPlayer.from( litPlayer );
		const serializedPlayer: LiteraturePlayer = JSON.parse( JSON.stringify( enhancedPlayer ) );

		expect( serializedPlayer.id ).toBe( litPlayer.id );
		expect( serializedPlayer.hand ).toEqual( litPlayer.hand );

		const deserializedPlayer = new EnhancedLitPlayer( serializedPlayer );
		const twoOfDiamonds = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.DIAMONDS } );
		const twoOfClubs = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.CLUBS } );

		expect( deserializedPlayer.id ).toBe( serializedPlayer.id );
		expect( deserializedPlayer.hand.containsAll( [ twoOfClubs, twoOfDiamonds ] ) ).toBeTruthy();
	} );
} );