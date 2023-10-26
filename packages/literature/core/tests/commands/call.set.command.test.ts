import { CallSetInput, CardMapping, GameStatus, Move, MoveType } from "@literature/types";
import type { HttpException } from "@nestjs/common";
import type { EventBus } from "@nestjs/cqrs";
import { CardSet } from "@s2h/cards";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CallSetCommand, CallSetCommandHandler } from "../../src/commands";
import { Messages } from "../../src/constants";
import { MoveCreatedEvent } from "../../src/events";
import { buildCardMappingData } from "../../src/utils";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockCallMove,
	mockCallSetInput as mockInput,
	mockPlayer1,
	mockPlayer2,
	mockPlayer4,
	mockPlayerIds
} from "../mockdata";

describe( "CallSetCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should throw error if unknown players are mentioned in call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ] === mockPlayer1.id ? mockPlayer2.id : mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
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

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardMappingData );

		expect.assertions( 2 );
		await handler.execute( command )
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
		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
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

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardMappingData );

		expect.assertions( 2 );
		await handler.execute( command )
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
		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
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

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardMappingData );

		expect.assertions( 2 );
		await handler.execute( command )
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
		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		expect.assertions( 2 );
		await handler.execute( command )
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
		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
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

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardMappingData );

		expect.assertions( 2 );
		await handler.execute( command )
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
		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
		const input: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3"
			}
		};

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( input, mockGameData, mockPlayerSpecificData, cardMappingData );

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.ALL_CARDS_NOT_CALLED );
			} );
	} );


	it( "should increase opposite team score and remove cards of set on unsuccessful call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];

			if ( card.id === "SixOfClubs" ) {
				return { cardId: card.id, playerId: mockPlayer4.id, gameId: "1" };
			}

			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const mockMove: Move = {
			...mockCallMove,
			success: false,
			data: { ...mockCallMove.data as any, correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id } },
			description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } incorrectly!`
		};

		mockPrisma.literature.move.create.mockResolvedValue( mockMove );

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( command );

		expect( result ).toEqual( mockMove );
		expect( mockPrisma.literature.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockGameData.id,
				type: MoveType.CALL_SET,
				success: false,
				description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } incorrectly!`,
				data: {
					by: mockPlayer1.id,
					cardSet: CardSet.LOWER_CLUBS,
					actualCall: mockInput.data,
					correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id }
				}
			}
		} );
		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new MoveCreatedEvent( mockMove, mockGameData, cardMappingData ) );
	} );

	it( "should increase current team score and remove cards of set on successful call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: [ "1", "2", "3", "4" ][ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		mockPrisma.literature.move.create.mockResolvedValue( mockCallMove );

		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( command );

		expect( result ).toEqual( mockCallMove );
		expect( mockPrisma.literature.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockGameData.id,
				type: MoveType.CALL_SET,
				success: true,
				description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } correctly!`,
				data: {
					by: mockPlayer1.id,
					cardSet: CardSet.LOWER_CLUBS,
					actualCall: mockInput.data,
					correctCall: mockInput.data
				}
			}
		} );
		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new MoveCreatedEvent( mockCallMove, mockGameData, cardMappingData ) );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );