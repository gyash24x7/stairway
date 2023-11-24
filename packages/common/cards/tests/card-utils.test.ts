import { expect, test } from "vitest";
import {
	CardRank,
	CardSet,
	chunk,
	generateGameCode,
	generateHandsFromCards,
	getAskableCardsOfSet,
	getCardSetsInHand,
	getCardsOfSet,
	isCardSetInHand,
	removeCardsOfRank,
	shuffle,
	sortCards,
	SORTED_DECK
} from "../src/index.js";

test( "Method::Shuffle should shuffle the elements in the array", () => {
	const arr = [ 0, 1, 2, 3, 4, 5 ];
	let shuffledArr: number[] = [];

	do {
		shuffledArr = shuffle( arr );
	} while ( arr === shuffledArr );

	expect( arr === shuffledArr ).toBeFalsy();
} );

test( "Method::Chunk should split the elements in the array into chunks", () => {
	const array = [ 0, 1, 2, 3, 4, 5 ];
	let [ chunk1, chunk2, chunk3 ] = chunk( array, 2 );

	expect( chunk1 ).toBeTruthy();
	expect( chunk1 ).toEqual( [ 0, 1 ] );

	expect( chunk2 ).toBeTruthy();
	expect( chunk2 ).toEqual( [ 2, 3 ] );

	expect( chunk3 ).toBeTruthy();
	expect( chunk3 ).toEqual( [ 4, 5 ] );
} );

test( "Method::GenerateGameCode should generate a 6 digit code", () => {
	const code = generateGameCode();
	expect( code.length ).toEqual( 6 );
} );

test( "Method::RemoveCardsOfRank should remove cards of specific rank", () => {
	const finalArray = removeCardsOfRank( SORTED_DECK, CardRank.NINE );
	expect( finalArray.some( card => card.rank === CardRank.NINE ) ).toBeFalsy();
} );

test( "Method:GenerateHandsFromCards should generate hands from specified cards", () => {
	const hands = generateHandsFromCards( SORTED_DECK, 2 );
	expect( hands.length ).toEqual( 2 );
	expect( hands[ 0 ].length ).toEqual( 26 );
	expect( hands[ 1 ].length ).toEqual( 26 );
} );

test( "Method:GenerateHandsFromCards should return empty array if cards cannot be split into hands", () => {
	const hands = generateHandsFromCards( SORTED_DECK, 3 );
	expect( hands.length ).toEqual( 0 );
} );

test( "Method::GetCardSetsInHand should return the card sets in the hand", () => {
	const hand = [ SORTED_DECK[ 0 ], SORTED_DECK[ 19 ], SORTED_DECK[ 25 ] ];
	const cardSets = getCardSetsInHand( hand );
	expect( cardSets.length ).toEqual( 2 );
	expect( cardSets[ 0 ] ).toEqual( CardSet.LOWER_HEARTS );
	expect( cardSets[ 1 ] ).toEqual( CardSet.UPPER_CLUBS );
} );

test( "Method::IsCardSetInHand should return true if the card set is in the hand", () => {
	const hand = [ SORTED_DECK[ 0 ], SORTED_DECK[ 19 ], SORTED_DECK[ 25 ] ];
	expect( isCardSetInHand( hand, CardSet.UPPER_CLUBS ) ).toBeTruthy();
	expect( isCardSetInHand( hand, CardSet.UPPER_SPADES ) ).toBeFalsy();
} );

test( "Method::GetCardsOfSet should return the cards of the specified set", () => {
	const hand = [ SORTED_DECK[ 0 ], SORTED_DECK[ 19 ], SORTED_DECK[ 25 ] ];
	const cards = getCardsOfSet( hand, CardSet.UPPER_CLUBS );
	expect( cards.length ).toEqual( 2 );
	expect( cards[ 0 ].id ).toEqual( "SevenOfClubs" );
	expect( cards[ 1 ].id ).toEqual( "KingOfClubs" );
} );

test( "Method::GetAskableCardsOfSet should return the cards that can be asked", () => {
	const hand = [ SORTED_DECK[ 0 ], SORTED_DECK[ 19 ], SORTED_DECK[ 25 ] ];
	const cards = getAskableCardsOfSet( hand, CardSet.UPPER_CLUBS );
	expect( cards.length ).toEqual( 5 );
	expect( cards[ 0 ].id ).toEqual( "EightOfClubs" );
	expect( cards[ 1 ].id ).toEqual( "NineOfClubs" );
	expect( cards[ 2 ].id ).toEqual( "TenOfClubs" );
	expect( cards[ 3 ].id ).toEqual( "JackOfClubs" );
	expect( cards[ 4 ].id ).toEqual( "QueenOfClubs" );
} );

test( "Method::SortCards should sort the cards", () => {
	const hand = [ SORTED_DECK[ 25 ], SORTED_DECK[ 19 ], SORTED_DECK[ 0 ], SORTED_DECK[ 14 ] ];
	const cards = sortCards( hand );
	expect( cards.length ).toEqual( 4 );
	expect( cards[ 0 ] ).toEqual( SORTED_DECK[ 0 ] );
	expect( cards[ 1 ] ).toEqual( SORTED_DECK[ 14 ] );
	expect( cards[ 2 ] ).toEqual( SORTED_DECK[ 19 ] );
	expect( cards[ 3 ] ).toEqual( SORTED_DECK[ 25 ] );
} );