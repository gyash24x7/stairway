import { LitMove, LitMoveType } from "@prisma/client";
import { CardRank, CardSuit, PlayingCard } from "@s2h/cards";
import { EnhancedLitMove, IEnhancedLitMove } from "@s2h/literature/utils";
import cuid from "cuid";
import { describe, expect, it } from "vitest";

describe( "Enhanced Lit Move", function () {

	const litMove: LitMove = {
		id: cuid(),
		description: "Move Description",
		type: LitMoveType.TURN,
		turnId: cuid(),
		askedFor: { rank: "Two", suit: "Diamonds" },
		askedFromId: null,
		askedById: null,
		gameId: cuid(),
		createdAt: new Date()
	};

	it( "should serialize and deserialize correctly", function () {
		const enhancedMove = EnhancedLitMove.from( litMove );
		const serializedMove: IEnhancedLitMove = JSON.parse( JSON.stringify( enhancedMove ) );

		expect( serializedMove.id ).toBe( litMove.id );
		expect( serializedMove.type ).toBe( "TURN" );
		expect( serializedMove.askedFor ).toEqual( litMove.askedFor );

		const deserializedMove = new EnhancedLitMove( serializedMove );

		expect( deserializedMove.id ).toBe( serializedMove.id );
		expect( deserializedMove.askedFor )
			.toEqual( PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.DIAMONDS } ) );
	} );
} );