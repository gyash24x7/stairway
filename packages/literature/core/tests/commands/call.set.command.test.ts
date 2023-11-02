import { CardMapping, GameStatus, Move, MoveType } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import { CardSet } from "@s2h/cards";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CallSetCommand, CallSetCommandHandler } from "../../src/commands";
import { MoveCreatedEvent } from "../../src/events";
import { buildCardMappingData } from "../../src/utils";
import type { CallSetValidator } from "../../src/validators";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockCallMove,
	mockCallSetInput as mockInput,
	mockPlayer1,
	mockPlayer4,
	mockPlayerIds
} from "../mockdata";

describe( "CallSetCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const mockValidator = mockDeep<CallSetValidator>();

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
		mockValidator.validate.mockResolvedValue( {
			correctCall: { ...mockInput.data, SixOfClubs: mockPlayer4.id },
			calledSet: CardSet.LOWER_CLUBS
		} );

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		const handler = new CallSetCommandHandler( mockPrisma, mockValidator, mockEventBus );
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

		expect( mockValidator.validate ).toHaveBeenCalledWith( command );

		const event = new MoveCreatedEvent( mockMove, mockGameData, cardMappingData );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should increase current team score and remove cards of set on successful call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const command = new CallSetCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		mockPrisma.literature.move.create.mockResolvedValue( mockCallMove );
		mockValidator.validate.mockResolvedValue( {
			correctCall: mockInput.data,
			calledSet: CardSet.LOWER_CLUBS
		} );

		const handler = new CallSetCommandHandler( mockPrisma, mockValidator, mockEventBus );
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

		expect( mockValidator.validate ).toHaveBeenCalledWith( command );

		const event = new MoveCreatedEvent( mockCallMove, mockGameData, cardMappingData );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
		mockClear( mockValidator );
	} );

} );