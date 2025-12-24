import type { CardId } from "@s2h/utils/cards";
import { generateBotInfo } from "@s2h/utils/generator";
import { describe, expect, it } from "vitest";
import type { BookType, NormalBook, PlayerGameInfo, WeightedBook } from "../src/types.ts";
import {
	getBookForCard,
	getBooksInHand,
	getCardsOfBook,
	getDefaultGameData,
	getMissingCards,
	isBookInHand,
	NORMAL_BOOKS,
	suggestAsks,
	suggestBooks,
	suggestClaims,
	suggestRiskyClaims,
	suggestTransfers
} from "../src/utils.ts";

describe( "Fish:Utils", () => {

	describe( "getBookForCard()", () => {
		it( "should return ACES for AC", () => {
			expect( getBookForCard( "AC" as CardId, "NORMAL" as BookType ) ).toBe( "ACES" );
		} );

		it( "should return TENS for 10C", () => {
			expect( getBookForCard( "10C" as CardId, "NORMAL" as BookType ) ).toBe( "TENS" );
		} );

		it( "should return KINGS for KS", () => {
			expect( getBookForCard( "KS" as CardId, "NORMAL" as BookType ) ).toBe( "KINGS" );
		} );

		it( "should return LC for AC", () => {
			expect( getBookForCard( "AC" as CardId, "CANADIAN" as BookType ) ).toBe( "LC" );
		} );

		it( "should return UC for 10C", () => {
			expect( getBookForCard( "10C" as CardId, "CANADIAN" as BookType ) ).toBe( "UC" );
		} );

		it( "should return US for KS", () => {
			expect( getBookForCard( "KS" as CardId, "CANADIAN" as BookType ) ).toBe( "US" );
		} );
	} );

	describe( "getBooksInHand()", () => {
		it( "should return empty array for empty hand (NORMAL)", () => {
			expect( getBooksInHand( [], "NORMAL" as BookType ) ).toEqual( [] );
		} );

		it( "detects single full NORMAL book (ACES)", () => {
			const hand: CardId[] = [ "AC", "AD", "AH", "AS" ];
			expect( getBooksInHand( hand, "NORMAL" as BookType ) ).toEqual( [ "ACES" ] );
		} );

		it( "detects multiple NORMAL books from mixed hand", () => {
			const hand: CardId[] = [ "AC", "AD", "AH", "AS", "2C", "2D" ]; // ACES + part of TWOS
			const books = getBooksInHand( hand, "NORMAL" as BookType );
			expect( new Set( books ) ).toEqual( new Set( [ "ACES", "TWOS" ] ) );
		} );

		it( "should return empty array for empty hand (CANADIAN)", () => {
			expect( getBooksInHand( [], "CANADIAN" as BookType ) ).toEqual( [] );
		} );

		it( "detects CANADIAN book LC and UC from mixed hand", () => {
			const hand: CardId[] = [ "AC", "2C", "3C", "4C", "5C", "6C", "10C", "JC" ];
			const books = getBooksInHand( hand, "CANADIAN" as BookType );
			expect( new Set( books ) ).toEqual( new Set( [ "LC", "UC" ] ) );
		} );
	} );

	describe( "isBookInHand()", () => {
		it( "should return true when book present (partial) - NORMAL", () => {
			const hand: CardId[] = [ "AC", "2C" ];
			expect( isBookInHand( hand, "ACES", "NORMAL" as BookType ) ).toBe( true );
		} );

		it( "should return false when book absent - NORMAL", () => {
			const hand: CardId[] = [ "2C", "3C" ];
			expect( isBookInHand( hand, "ACES", "NORMAL" as BookType ) ).toBe( false );
		} );

		it( "should return true when book present (partial) - CANADIAN", () => {
			const hand: CardId[] = [ "AC", "10C" ];
			expect( isBookInHand( hand, "LC", "CANADIAN" as BookType ) ).toBe( true );
		} );
	} );

	describe( "getMissingCards()", () => {
		it( "should return empty array if full NORMAL book in hand", () => {
			const hand: CardId[] = [ "AC", "AD", "AH", "AS" ];
			expect( getMissingCards( hand, "ACES", "NORMAL" as BookType ) ).toEqual( [] );
		} );

		it( "should return missing cards for partial NORMAL book", () => {
			const hand: CardId[] = [ "AC", "AD" ];
			expect( getMissingCards( hand, "ACES", "NORMAL" as BookType ) ).toEqual( [ "AH", "AS" ] );
		} );

		it( "should return full CANADIAN book when hand empty", () => {
			expect( getMissingCards( [], "LC", "CANADIAN" as BookType ) )
				.toEqual( [ "AC", "2C", "3C", "4C", "5C", "6C" ] );
		} );

		it( "should return missing CANADIAN cards for partial hand", () => {
			const hand: CardId[] = [ "AC", "2C", "3C" ];
			expect( getMissingCards( hand, "LC", "CANADIAN" as BookType ) ).toEqual( [ "4C", "5C", "6C" ] );
		} );
	} );

	describe( "getCardsOfBook()", () => {
		it( "should return full NORMAL book when hand not provided", () => {
			expect( getCardsOfBook( "ACES", "NORMAL" as BookType ) ).toEqual( [ "AC", "AD", "AH", "AS" ] );
		} );

		it( "should return full CANADIAN book when hand not provided", () => {
			expect( getCardsOfBook( "LC", "CANADIAN" as BookType ) ).toEqual( [ "AC", "2C", "3C", "4C", "5C", "6C" ] );
		} );

		it( "should return intersection of NORMAL book and hand when provided", () => {
			const hand: CardId[] = [ "AC", "AD", "2C" ];
			expect( getCardsOfBook( "ACES", "NORMAL" as BookType, hand ) ).toEqual( [ "AC", "AD" ] );
		} );

		it( "should return intersection of CANADIAN book and hand when provided", () => {
			const hand: CardId[] = [ "AC", "3C", "5C", "10C" ];
			expect( getCardsOfBook( "LC", "CANADIAN" as BookType, hand ) ).toEqual( [ "AC", "3C", "5C" ] );
		} );

		it( "should return empty when hand has none from the NORMAL book", () => {
			const hand: CardId[] = [ "2C", "3C" ];
			expect( getCardsOfBook( "ACES", "NORMAL" as BookType, hand ) ).toEqual( [] );
		} );

		it( "should return empty when hand has none from the CANADIAN book", () => {
			const hand: CardId[] = [ "7C", "8C", "9C" ];
			expect( getCardsOfBook( "LC", "CANADIAN" as BookType, hand ) ).toEqual( [] );
		} );

	} );

	describe( "getDefaultGameData()", () => {

		it( "should return correct default game data", () => {
			const gameData = getDefaultGameData();
			expect( gameData.id.length ).toBeGreaterThan( 0 );
			expect( gameData.code.length ).toBe( 6 );
			expect( gameData.config.type ).toBe( "NORMAL" );
			expect( gameData.players ).toEqual( {} );
			expect( gameData.hands ).toEqual( {} );
			expect( gameData.status ).toBe( "CREATED" );
		} );

	} );

	const normalGameConfig = {
		type: "NORMAL",
		playerCount: 6,
		teamCount: 2,
		deckType: 48,
		books: Object.keys( NORMAL_BOOKS ).map( k => k as NormalBook )
	};

	const p1 = {
		...generateBotInfo(),
		id: "p1",
		teamId: "t1",
		isBot: false,
		teamMates: [ "p2", "p3" ],
		opponents: [ "p4", "p5", "p6" ]
	};

	const gameInfo = {
		playerId: "p1",
		config: normalGameConfig,
		players: { p1 },
		cardLocations: {
			"AC": [ "p1", "p2", "p3", "p4", "p5", "p6" ],
			"AD": [ "p1", "p2", "p3", "p4", "p5", "p6" ],
			"AH": [ "p1", "p2", "p3", "p4", "p5", "p6" ],
			"AS": [ "p1", "p2", "p3", "p4", "p5", "p6" ],
			"2C": [ "p1", "p2", "p3", "p4", "p5", "p6" ],
			"2D": [ "p1", "p2", "p3", "p4", "p5", "p6" ],
			"2H": [ "p1", "p2", "p3", "p4", "p5", "p6" ],
			"2S": [ "p1", "p2", "p3", "p4", "p5", "p6" ]
		},
		hand: [ "AC", "AD", "2C", "2D" ],
		cardCounts: { p1: 8, p2: 8, p3: 8, p4: 8, p5: 8, p6: 8 }
	} as unknown as PlayerGameInfo;

	describe( "suggestBooks()", () => {

		it( "should suggest ACES and TWOS for player with partial books", () => {
			const suggestedBooks = suggestBooks( gameInfo );
			expect( suggestedBooks[ 0 ] ).toEqual( {
				book: "ACES",
				weight: ( 720 + 720 + 120 + 120 ) / 4,
				isBookWithTeam: false,
				isClaimable: false,
				isKnown: false
			} );

			expect( suggestedBooks[ 1 ] ).toEqual( {
				book: "TWOS",
				weight: ( 720 + 720 + 120 + 120 ) / 4,
				isBookWithTeam: false,
				isClaimable: false,
				isKnown: false
			} );
		} );

		it( "should give higher weight to books whose more cards are in hand", () => {
			const modifiedGameInfo: PlayerGameInfo = {
				...gameInfo,
				hand: [ "AC", "AD", "AH", "2C" ]
			};

			const suggestedBooks = suggestBooks( modifiedGameInfo );
			expect( suggestedBooks[ 0 ].book ).toBe( "ACES" );
			expect( suggestedBooks[ 1 ].book ).toBe( "TWOS" );
			expect( suggestedBooks[ 0 ].weight ).toBe( 570 );
			expect( suggestedBooks[ 1 ].weight ).toBe( 270 );
		} );

		it( "should mark books as claimable when all cards are with the player", () => {
			const modifiedGameInfo: PlayerGameInfo = {
				...gameInfo,
				hand: [ "AC", "AD", "AH", "AS" ] // Full ACES book
			};

			const suggestedBooks = suggestBooks( modifiedGameInfo );
			const acesBook = suggestedBooks.find( b => b.book === "ACES" );
			expect( acesBook ).toBeDefined();
			expect( acesBook?.isKnown ).toBe( true );
			expect( acesBook?.isBookWithTeam ).toBe( true );
			expect( acesBook?.isClaimable ).toBe( true );
			expect( acesBook?.weight ).toBe( 720 );
		} );

		it( "should mark books as claimable when all cards are with the team", () => {
			const modifiedGameInfo: PlayerGameInfo = {
				...gameInfo,
				cardLocations: {
					...gameInfo.cardLocations,
					AC: [ "p2" ],
					AD: [ "p3" ]
				},
				hand: [ "AH", "AS" ]
			};

			const suggestedBooks = suggestBooks( modifiedGameInfo );
			const acesBook = suggestedBooks.find( b => b.book === "ACES" );
			expect( acesBook ).toBeDefined();
			expect( acesBook?.isKnown ).toBe( true );
			expect( acesBook?.isBookWithTeam ).toBe( true );
			expect( acesBook?.isClaimable ).toBe( true );
			expect( acesBook?.weight ).toBe( 720 );
		} );

		it( "should mark books as with team when all possible players are team mates", () => {
			const modifiedGameInfo: PlayerGameInfo = {
				...gameInfo,
				cardLocations: {
					...gameInfo.cardLocations,
					AC: [ "p2", "p3" ],
					AD: [ "p2", "p3" ]
				},
				hand: [ "AH", "AS" ]
			};

			const suggestedBooks = suggestBooks( modifiedGameInfo );
			const acesBook = suggestedBooks.find( b => b.book === "ACES" );
			expect( acesBook ).toBeDefined();
			expect( acesBook?.isKnown ).toBe( false );
			expect( acesBook?.isBookWithTeam ).toBe( true );
			expect( acesBook?.isClaimable ).toBe( false );
			expect( acesBook?.weight ).toBe( ( 720 + 720 + 360 + 360 ) / 4 );
		} );

		it( "should give more weight to books with known owners", () => {
			const modifiedGameInfo: PlayerGameInfo = {
				...gameInfo,
				cardLocations: {
					...gameInfo.cardLocations,
					AC: [ "p4" ],
					AS: [ "p5", "p6" ],
					AH: [ "p2" ]
				},
				hand: [ "AD", "2C", "2D" ]
			};

			const suggestedBooks = suggestBooks( modifiedGameInfo );
			const acesBook = suggestedBooks.find( b => b.book === "ACES" );
			expect( acesBook ).toBeDefined();
			expect( acesBook?.isBookWithTeam ).toBe( false );
			expect( acesBook?.weight ).toBe( ( 720 + 720 + 720 + 360 ) / 4 );
		} );

		it( "should only return weighted books with positive weight", () => {
			const modifiedGameInfo: PlayerGameInfo = { ...gameInfo, hand: [ "3C" ] };
			const suggestedBooks = suggestBooks( modifiedGameInfo );
			expect( suggestedBooks.length ).toBe( 0 );
		} );

	} );

	describe( "suggestAsks()", () => {

		it( "recommends asking opponents for missing cards with correct weights", () => {
			const modifiedGameInfo = {
				...gameInfo,
				hand: [ "AD", "AH" ] as CardId[], // missing AC and AS from ACES
				cardLocations: {
					AC: [ "p4" ], // known opponent
					AS: [ "p4", "p5" ], // two possible opponents
					AD: [ "p1" ],
					AH: [ "p1" ]
				}
			};

			const books: WeightedBook[] = [
				{
					book: "ACES",
					weight: 0,
					isBookWithTeam: false,
					isClaimable: false,
					isKnown: true
				}
			];

			const asks = suggestAsks( books, modifiedGameInfo );

			expect( asks ).toEqual( [
				{ playerId: "p4", cardId: "AC", weight: 720 },
				{ playerId: "p4", cardId: "AS", weight: 360 },
				{ playerId: "p5", cardId: "AS", weight: 360 }
			] );
		} );

		it( "excludes team mates from ask suggestions", () => {
			const modifiedGameInfo = {
				...gameInfo,
				hand: [ "5D", "5H" ] as CardId[], // missing 5C and 5S from FIVES
				cardLocations: {
					"5C": [ "p2", "p3" ], // only team mates
					"5S": [ "p2", "p5" ]
				}
			};

			const books: WeightedBook[] = [
				{
					book: "FIVES",
					weight: 0,
					isBookWithTeam: true,
					isClaimable: false,
					isKnown: false
				}
			];

			const asks = suggestAsks( books, modifiedGameInfo );
			expect( asks ).toEqual( [ { playerId: "p5", cardId: "5S", weight: 360 } ] );
		} );

	} );

	describe( "suggestClaims()", () => {

		it( "returns a full claim when all cards have single known owners and are with team", () => {
			const modifiedGameInfo = {
				...gameInfo,
				cardLocations: {
					AC: [ "p1" ],
					AD: [ "p2" ],
					AH: [ "p2" ],
					AS: [ "p2" ],
					"2C": [ "p1" ],
					"2D": [ "p1" ],
					"2H": [ "p3" ],
					"2S": [ "p3" ]
				}
			};

			const books: WeightedBook[] = [
				{
					book: "ACES",
					weight: 720,
					isBookWithTeam: true,
					isClaimable: true,
					isKnown: true
				},
				{
					book: "TWOS",
					weight: 720,
					isBookWithTeam: true,
					isClaimable: true,
					isKnown: true
				}
			];

			const claims = suggestClaims( books, modifiedGameInfo );
			expect( claims.length ).toBe( 2 );

			expect( claims[ 0 ].book ).toBe( "ACES" );
			expect( claims[ 0 ].weight ).toBe( 720 );
			expect( claims[ 0 ].claim ).toEqual( { AC: "p1", AD: "p2", AH: "p2", AS: "p2" } );

			expect( claims[ 1 ].book ).toBe( "TWOS" );
			expect( claims[ 1 ].weight ).toBe( 720 );
			expect( claims[ 1 ].claim ).toEqual( { "2C": "p1", "2D": "p1", "2H": "p3", "2S": "p3" } );
		} );

		it( "ignores books that are not fully known", () => {
			const modifiedGameInfo = {
				...gameInfo,
				cardLocations: {
					AC: [ "p2" ],
					AD: [ "p2" ],
					AH: [ "p2", "p3" ], // not single owner
					AS: [ "p2" ]
				}
			};

			const books: WeightedBook[] = [
				{
					book: "ACES",
					weight: 720,
					isBookWithTeam: true,
					isClaimable: true,
					isKnown: true
				}
			];

			const claims = suggestClaims( books, modifiedGameInfo );
			expect( claims ).toEqual( [] );
		} );

	} );

	describe( "suggestRiskyClaims()", () => {

		it( "returns risky claim suggestions when book is with team but not all owners known", () => {
			const modifiedGameInfo = {
				...gameInfo,
				cardLocations: {
					AC: [ "p2", "p3" ],
					AD: [ "p2" ],
					AH: [ "p3" ],
					AS: [ "p1" ]
				}
			};

			const books: WeightedBook[] = [
				{
					book: "ACES",
					weight: 540,
					isBookWithTeam: true,
					isClaimable: false,
					isKnown: false
				}
			];

			const claims = suggestRiskyClaims( books, modifiedGameInfo );
			expect( claims.length ).toBe( 2 );
			expect( claims[ 0 ].book ).toBe( "ACES" );
			expect( claims[ 0 ].weight ).toBeLessThan( 720 );
			expect( claims[ 0 ].claim ).toEqual( { AC: "p2", AD: "p2", AH: "p3", AS: "p1" } );

			expect( claims[ 1 ].book ).toBe( "ACES" );
			expect( claims[ 1 ].weight ).toBeLessThan( 720 );
			expect( claims[ 1 ].claim ).toEqual( { AC: "p3", AD: "p2", AH: "p3", AS: "p1" } );

		} );
	} );

	describe( "suggestTransfers()", () => {

		it( "aggregates transfers to team mates for known single-owner cards", () => {
			const gameInfo = {
				playerId: "p1",
				config: normalGameConfig,
				players: { p1: { ...p1 } },
				cardLocations: {
					AC: [ "p2" ],
					AD: [ "p2" ],
					AH: [ "p3" ],
					AS: [ "p4" ] // opponent - should be ignored
				}
			} as unknown as PlayerGameInfo;

			const transfers = suggestTransfers( gameInfo );
			expect( transfers ).toEqual( [ { transferTo: "p2", weight: 720 * 2 }, { transferTo: "p3", weight: 720 } ] );
		} );

		it( "returns empty when no team-mate single-owner cards", () => {
			const gameInfo = {
				playerId: "p1",
				config: normalGameConfig,
				players: { p1: { ...p1 } },
				cardLocations: {
					AC: [ "p4" ],
					AD: [ "p5", "p6" ]
				}
			} as unknown as PlayerGameInfo;

			const transfers = suggestTransfers( gameInfo );
			expect( transfers ).toEqual( [] );
		} );

	} );
} );
