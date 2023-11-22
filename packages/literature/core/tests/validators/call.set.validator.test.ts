import { CallSetInput, CardMapping, GameStatus } from "@literature/types";
import type { HttpException } from "@nestjs/common";
import { CardSet } from "@s2h/cards";
import { describe, expect, it } from "vitest";
import { CallSetCommand } from "../../src/commands";
import { Messages } from "../../src/constants/literature.constants";
import { CallSetValidator } from "../../src/validators";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockCallSetInput as mockInput,
	mockPlayer1,
	mockPlayer2,
	mockPlayerIds
} from "../mockdata";
import { buildCardsData } from "../mockdata/utils";

describe( "CallSetValidator", () => {

	it( "should throw error if unknown players are mentioned in call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ] === mockPlayer1.id ? mockPlayer2.id : mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const validator = new CallSetValidator();
		const input: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3",
				EightOfClubs: "5"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardsData );

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.PLAYER_NOT_PART_OF_GAME );
			} );
	} );

	it( "should throw error if calling player doesn't call his own cards", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ] === mockPlayer1.id ? mockPlayer2.id : mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const validator = new CallSetValidator();
		const input: CallSetInput = {
			data: {
				AceOfClubs: "3",
				TwoOfClubs: "3",
				ThreeOfClubs: "3",
				FourOfClubs: "3",
				FiveOfClubs: "3",
				EightOfClubs: "4"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardsData );

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.DIDNT_CALL_OWN_CARDS );
			} );
	} );

	it( "should throw error if multiple sets are called", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ] === mockPlayer1.id ? mockPlayer2.id : mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const validator = new CallSetValidator();
		const input: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3",
				EightOfClubs: "4"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardsData );

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.MULTIPLE_SETS_CALLED );
			} );
	} );

	it( "should throw error if calling player doesn't have cards of that set", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ] === mockPlayer1.id ? mockPlayer2.id : mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const validator = new CallSetValidator();

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardsData );

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.SET_CALLED_WITHOUT_CARDS );
			} );
	} );

	it( "should throw error if players from multiple teams are called", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const validator = new CallSetValidator();
		const input: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3",
				SixOfClubs: "4"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardsData );

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.SET_CALLED_FROM_MULTIPLE_TEAMS );
			} );
	} );

	it( "should throw error if all cards of set are not called", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const validator = new CallSetValidator();
		const input: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardsData );

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.ALL_CARDS_NOT_CALLED );
			} );
	} );

	it( "should return the correct call and called set if valid", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardsData );

		const validator = new CallSetValidator();
		const { correctCall, calledSet } = await validator.validate( command );

		expect( correctCall ).toEqual( mockInput.data );
		expect( calledSet ).toEqual( CardSet.LOWER_CLUBS );
	} );

} );