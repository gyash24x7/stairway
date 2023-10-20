import { afterEach, describe, expect, it } from "vitest";
import { CardMapping, GameStatus, MoveType } from "@literature/data";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import type { EventBus } from "@nestjs/cqrs";
import { AskCardCommand, AskCardCommandHandler } from "../../src/commands";
import { GameUpdateEvent, MoveCreatedEvent } from "../../src/events";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";
import {
	buildMockAggregatedGameData,
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

	const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappingList );
	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should throw error if asked player is not part of game", async () => {
		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		expect.assertions( 2 );
		await handler.execute( new AskCardCommand(
			{ ...mockInput, askedFrom: "5" },
			mockAggregatedGameData,
			mockAuthInfo
		) ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.PLAYER_NOT_PART_OF_GAME );
		} );
	} );

	it( "should throw error if asked card is with current player ", async () => {
		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		expect.assertions( 2 );
		await handler.execute( new AskCardCommand(
			mockInput,
			mockAggregatedGameData,
			{ ...mockAuthInfo, id: mockPlayer2.id }
		) ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.ASKED_CARD_WITH_ASKING_PLAYER );
		} );
	} );

	it( "should throw error if asked player from same team", async () => {
		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		expect.assertions( 2 );
		await handler.execute( new AskCardCommand(
			{ ...mockInput, askedFrom: mockPlayer3.id },
			mockAggregatedGameData,
			mockAuthInfo
		) ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.ASKED_PLAYER_FROM_SAME_TEAM );
		} );
	} );

	it( "should transfer the chance to asked player when asked incorrectly and create ask move", async () => {
		mockPrisma.literature.move.create.mockResolvedValue( mockAskMove );

		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( new AskCardCommand(
			{ ...mockInput, askedFrom: mockPlayer4.id },
			mockAggregatedGameData,
			mockAuthInfo
		) );

		expect( result ).toBe( mockAggregatedGameData.id );
		expect( mockPrisma.literature.move.create ).toBeCalledTimes( 1 );
		expect( mockPrisma.literature.move.create ).toBeCalledWith( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: mockAggregatedGameData.id,
				success: false,
				data: {
					from: mockPlayer4.id,
					by: mockAuthInfo.id,
					card: mockInput.askedFor
				},
				description: `${ mockPlayer1.name } asked ${ mockPlayer4.name } for ${ mockInput.askedFor } and was declined!`
			}
		} );
		expect( mockPrisma.literature.cardMapping.update ).toBeCalledTimes( 0 );
		expect( mockPrisma.literature.game.update ).toBeCalledTimes( 1 );
		expect( mockPrisma.literature.game.update ).toBeCalledWith( {
			where: { id: mockAggregatedGameData.id },
			data: { currentTurn: mockPlayer4.id }
		} );
		expect( mockEventBus.publish ).toBeCalledTimes( 2 );
		expect( mockEventBus.publish ).toBeCalledWith( new MoveCreatedEvent( mockAskMove ) );
		expect( mockEventBus.publish ).toBeCalledWith( new GameUpdateEvent( mockAggregatedGameData, mockAuthInfo ) );
	} );

	it( "should transfer the card to the asking player when asked correctly and create ask move", async () => {
		mockPrisma.literature.move.create.mockResolvedValue( mockAskMove );

		const handler = new AskCardCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( new AskCardCommand( mockInput, mockAggregatedGameData, mockAuthInfo ) );

		expect( result ).toBe( mockAggregatedGameData.id );
		expect( mockPrisma.literature.move.create ).toBeCalledTimes( 1 );
		expect( mockPrisma.literature.move.create ).toBeCalledWith( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: mockAggregatedGameData.id,
				success: true,
				data: {
					from: mockInput.askedFrom,
					by: mockAuthInfo.id,
					card: mockInput.askedFor
				},
				description: `${ mockPlayer1.name } asked ${ mockPlayer2.name } for ${ mockInput.askedFor } and got the card!`
			}
		} );
		expect( mockPrisma.literature.cardMapping.update ).toBeCalledTimes( 1 );
		expect( mockPrisma.literature.cardMapping.update ).toBeCalledWith( {
			where: { cardId_gameId: { cardId: mockInput.askedFor, gameId: mockAggregatedGameData.id } },
			data: { playerId: mockPlayer1.id }
		} );
		expect( mockEventBus.publish ).toBeCalledTimes( 2 );
		expect( mockEventBus.publish ).toBeCalledWith( new MoveCreatedEvent( mockAskMove ) );
		expect( mockEventBus.publish ).toBeCalledWith( new GameUpdateEvent( mockAggregatedGameData, mockAuthInfo ) );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );