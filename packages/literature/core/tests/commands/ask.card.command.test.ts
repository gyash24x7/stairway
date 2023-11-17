import { CardMapping, GameStatus, MoveType } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { AskCardCommand, AskCardCommandHandler } from "../../src/commands";
import { MoveCreatedEvent } from "../../src/events";
import type { AskCardValidator } from "../../src/validators";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockAskCardInput as mockInput,
	mockAskMove,
	mockAuthUser,
	mockPlayer1,
	mockPlayer2,
	mockPlayer4,
	mockPlayerIds
} from "../mockdata";
import { buildCardsData } from "../mockdata/utils";

describe( "AskCardCommand", () => {

	const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
		if ( card.id === mockInput.askedFor ) {
			return { cardId: card.id, playerId: mockPlayer2.id, gameId: "1" };
		}
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	const cardsData = buildCardsData( cardMappingList );

	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
	const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const mockValidator = mockDeep<AskCardValidator>();

	it( "should transfer the turn to asked player when asked incorrectly and create ask move", async () => {
		mockValidator.validate.mockResolvedValue( { askedPlayer: mockPlayer4, playerWithAskedCard: mockPlayer1 } );
		mockPrisma.literature.move.create.mockResolvedValue( mockAskMove );

		const handler = new AskCardCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const command = new AskCardCommand(
			{ ...mockInput, askedFrom: mockPlayer4.id },
			mockGameData,
			mockPlayerSpecificData,
			cardsData
		);

		const result = await handler.execute( command );

		expect( result ).toEqual( { ...mockAskMove, data: { ...mockAskMove.data as any, from: mockPlayer4.id } } );
		expect( mockPrisma.literature.move.create ).toBeCalledTimes( 1 );
		expect( mockPrisma.literature.move.create ).toBeCalledWith( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: mockGameData.id,
				success: false,
				data: {
					from: mockPlayer4.id,
					by: mockAuthUser.id,
					card: mockInput.askedFor
				},
				description: `${ mockPlayer1.name } asked ${ mockPlayer4.name } for ${ mockInput.askedFor } and was declined!`
			}
		} );

		expect( mockValidator.validate ).toHaveBeenCalledWith( command );

		const event = new MoveCreatedEvent( mockAskMove, mockGameData, cardsData );
		expect( mockEventBus.publish ).toBeCalledWith( event );
	} );

	it( "should transfer the card to the asking player when asked correctly and create ask move", async () => {
		mockValidator.validate.mockResolvedValue( { askedPlayer: mockPlayer2, playerWithAskedCard: mockPlayer2 } );
		mockPrisma.literature.move.create.mockResolvedValue( mockAskMove );

		const handler = new AskCardCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const command = new AskCardCommand( mockInput, mockGameData, mockPlayerSpecificData, cardsData );
		const result = await handler.execute( command );

		expect( result ).toEqual( mockAskMove );
		expect( mockPrisma.literature.move.create ).toBeCalledTimes( 1 );
		expect( mockPrisma.literature.move.create ).toBeCalledWith( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: mockGameData.id,
				success: true,
				data: {
					from: mockInput.askedFrom,
					by: mockAuthUser.id,
					card: mockInput.askedFor
				},
				description: `${ mockPlayer1.name } asked ${ mockPlayer2.name } for ${ mockInput.askedFor } and got the card!`
			}
		} );

		expect( mockValidator.validate ).toHaveBeenCalledWith( command );

		const event = new MoveCreatedEvent( mockAskMove, mockGameData, cardsData );
		expect( mockEventBus.publish ).toBeCalledWith( event );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
		mockClear( mockValidator );
	} );

} );