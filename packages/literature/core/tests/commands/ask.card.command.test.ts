import { CardMapping, GameStatus, MoveType } from "@literature/types";
import type { HttpException } from "@nestjs/common";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { AskCardCommand, AskCardCommandHandler } from "../../src/commands";
import { Messages } from "../../src/constants";
import { MoveCreatedEvent } from "../../src/events";
import { buildCardMappingData } from "../../src/utils";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockAskCardInput as mockInput,
	mockAskMove,
	mockAuthInfo,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockPlayerIds
} from "../mockdata";

describe( "AskCardCommand", () => {

	const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
		if ( card.id === mockInput.askedFor ) {
			return { cardId: card.id, playerId: mockPlayer2.id, gameId: "1" };
		}
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	const cardMappingData = buildCardMappingData( cardMappingList );

	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
	const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should throw error if asked player is not part of game", async () => {
		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		const command = new AskCardCommand(
			{ ...mockInput, askedFrom: "5" },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await handler.execute( command ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.PLAYER_NOT_PART_OF_GAME );
		} );
	} );

	it( "should throw error if asked card is with current player ", async () => {
		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		const command = new AskCardCommand(
			mockInput,
			mockGameData,
			{ ...mockPlayerSpecificData, id: mockPlayer2.id },
			cardMappingData
		);

		expect.assertions( 2 );
		await handler.execute( command ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.ASKED_CARD_WITH_ASKING_PLAYER );
		} );
	} );

	it( "should throw error if asked player from same team", async () => {
		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		const command = new AskCardCommand(
			{ ...mockInput, askedFrom: mockPlayer3.id },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await handler.execute( command ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.ASKED_PLAYER_FROM_SAME_TEAM );
		} );
	} );

	it( "should transfer the turn to asked player when asked incorrectly and create ask move", async () => {
		mockPrisma.literature.move.create.mockResolvedValue( mockAskMove );

		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		const command = new AskCardCommand(
			{ ...mockInput, askedFrom: mockPlayer4.id },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
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
					by: mockAuthInfo.id,
					card: mockInput.askedFor
				},
				description: `${ mockPlayer1.name } asked ${ mockPlayer4.name } for ${ mockInput.askedFor } and was declined!`
			}
		} );
		expect( mockEventBus.publish )
			.toBeCalledWith( new MoveCreatedEvent( mockAskMove, mockGameData, cardMappingData ) );
	} );

	it( "should transfer the card to the asking player when asked correctly and create ask move", async () => {
		mockPrisma.literature.move.create.mockResolvedValue( mockAskMove );

		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		const command = new AskCardCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );
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
					by: mockAuthInfo.id,
					card: mockInput.askedFor
				},
				description: `${ mockPlayer1.name } asked ${ mockPlayer2.name } for ${ mockInput.askedFor } and got the card!`
			}
		} );
		expect( mockEventBus.publish )
			.toBeCalledWith( new MoveCreatedEvent( mockAskMove, mockGameData, cardMappingData ) );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );