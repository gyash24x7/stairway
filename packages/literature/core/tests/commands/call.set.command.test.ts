import { afterEach, describe, expect, it } from "vitest";
import { CallSetInput, CardMapping, GameStatus, Move, MoveType } from "@literature/data";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "../../src/services";
import type { EventBus } from "@nestjs/cqrs";
import { CardSet } from "@s2h/cards";
import { CallSetCommand, CallSetCommandHandler } from "../../src/commands";
import { GameUpdateEvent, MoveCreatedEvent } from "../../src/events";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";
import {
	buildMockAggregatedGameData,
	deck,
	mockAuthInfo,
	mockCallMove,
	mockCallSetInput as mockInput,
	mockPlayer1,
	mockPlayer2,
	mockPlayer4,
	mockPlayerIds,
	mockTeamA,
	mockTeamB
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

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );
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

		expect.assertions( 2 );
		await handler.execute( new CallSetCommand( input, mockAggregatedGameData, mockAuthInfo ) )
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

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );
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

		expect.assertions( 2 );
		await handler.execute( new CallSetCommand( input, mockAggregatedGameData, mockAuthInfo ) )
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

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );
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

		expect.assertions( 2 );
		await handler.execute( new CallSetCommand( input, mockAggregatedGameData, mockAuthInfo ) )
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

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );

		expect.assertions( 2 );
		await handler.execute( new CallSetCommand( mockInput, mockAggregatedGameData, mockAuthInfo ) )
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

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );
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

		expect.assertions( 2 );
		await handler.execute( new CallSetCommand( input, mockAggregatedGameData, mockAuthInfo ) )
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

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );
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

		expect.assertions( 2 );
		await handler.execute( new CallSetCommand( input, mockAggregatedGameData, mockAuthInfo ) )
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

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const mockMove: Move = {
			...mockCallMove,
			success: false,
			data: { ...mockCallMove.data as any, correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id } },
			description: `${ mockPlayer1.name } called ${ CardSet.LOWER_CLUBS } incorrectly!`
		};

		mockPrisma.move.create.mockResolvedValue( mockMove );
		mockPrisma.team.update.mockResolvedValue( { ...mockTeamB, score: 1, setsWon: [ CardSet.LOWER_CLUBS ] } );

		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( new CallSetCommand( mockInput, mockAggregatedGameData, mockAuthInfo ) );

		expect( result ).toEqual( mockAggregatedGameData.id );
		expect( mockPrisma.cardMapping.deleteMany ).toHaveBeenCalledWith( {
			where: {
				cardId: { in: Object.keys( mockInput.data ) }
			}
		} );
		expect( mockPrisma.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockAggregatedGameData.id,
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
		expect( mockEventBus.publish ).toHaveBeenCalledWith( new MoveCreatedEvent( mockMove ) );
		expect( mockPrisma.team.update ).toHaveBeenCalledWith( {
			where: { id: mockTeamB.id },
			data: {
				score: 1,
				setsWon: [ CardSet.LOWER_CLUBS ]
			}
		} );

		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new GameUpdateEvent( mockAggregatedGameData, mockAuthInfo ) );
	} );

	it( "should increase current team score and remove cards of set on successful call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: [ "1", "2", "3", "4" ][ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );

		mockPrisma.move.create.mockResolvedValue( mockCallMove );
		mockPrisma.team.update.mockResolvedValue( { ...mockTeamA, score: 1, setsWon: [ CardSet.LOWER_CLUBS ] } );

		const handler = new CallSetCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( new CallSetCommand( mockInput, mockAggregatedGameData, mockAuthInfo ) );

		expect( result ).toEqual( mockAggregatedGameData.id );
		expect( mockPrisma.cardMapping.deleteMany ).toHaveBeenCalledWith( {
			where: {
				cardId: { in: Object.keys( mockInput.data ) }
			}
		} );
		expect( mockPrisma.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockAggregatedGameData.id,
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
		expect( mockEventBus.publish ).toHaveBeenCalledWith( new MoveCreatedEvent( mockCallMove ) );
		expect( mockPrisma.team.update ).toHaveBeenCalledWith( {
			where: { id: mockTeamA.id },
			data: {
				score: 1,
				setsWon: [ CardSet.LOWER_CLUBS ]
			}
		} );

		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new GameUpdateEvent( mockAggregatedGameData, mockAuthInfo ) );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );