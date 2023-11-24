import { expect, test } from "vitest";
import { CardRank, CardSuit, getPlayingCardFromId, getPlayingCardFromRankAndSuit } from "../src";

test( "Method:GetPlayingCardFromId should return a playing card from a valid id", () => {
	const card = getPlayingCardFromId( "AceOfHearts" );
	expect( card ).toBeDefined();
	expect( card.id ).toBe( "AceOfHearts" );
	expect( card.rank ).toBe( "Ace" );
	expect( card.suit ).toBe( "Hearts" );
	expect( card.set ).toBe( "Lower Hearts" );
	expect( card.displayString ).toBe( "Ace of Hearts" );
} );

test( "Method:GetPlayingCardFromRankAndSuit should return a playing card from a valid id", () => {
	const card = getPlayingCardFromRankAndSuit( CardRank.NINE, CardSuit.HEARTS );
	expect( card ).toBeDefined();
	expect( card.id ).toBe( "NineOfHearts" );
	expect( card.rank ).toBe( "Nine" );
	expect( card.suit ).toBe( "Hearts" );
	expect( card.set ).toBe( "Upper Hearts" );
	expect( card.displayString ).toBe( "Nine of Hearts" );
} );