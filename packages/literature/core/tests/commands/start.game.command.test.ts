import { afterEach, describe, expect, it } from "vitest";
import { GameStatus } from "@literature/data";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "../../src/services";
import type { EventBus } from "@nestjs/cqrs";
import { StartGameCommand, StartGameCommandHandler } from "../../src/commands";
import { GameUpdateEvent } from "../../src/events";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";
import { buildMockAggregatedGameData, deck, mockAuthInfo, mockPlayerIds } from "../mockdata";

describe( "StartGameCommand", () => {

	const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.TEAMS_CREATED );
	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should throw error if teams have not been created", () => {
		expect.assertions( 2 );
		const handler = new StartGameCommandHandler( mockPrisma, mockEventBus );
		handler.execute( new StartGameCommand(
			{ ...mockAggregatedGameData, status: GameStatus.CREATED },
			mockAuthInfo
		) ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.TEAMS_NOT_CREATED );
		} );
	} );

	it( "should create card mappings and start the game", async () => {
		const mock = mockPrisma.cardMapping.create;
		deck.forEach( ( card, index ) => {
			mock.mockResolvedValueOnce( {
				cardId: card.id,
				gameId: mockAggregatedGameData.id,
				playerId: mockPlayerIds[ index % mockAggregatedGameData.playerCount ]
			} );
		} );

		const handler = new StartGameCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( new StartGameCommand( mockAggregatedGameData, mockAuthInfo ) );

		expect( result ).toBe( mockAggregatedGameData.id );
		expect( mock ).toHaveBeenCalledTimes( deck.length );
		expect( mockPrisma.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAggregatedGameData.id },
			data: {
				status: GameStatus.IN_PROGRESS,
				currentTurn: mockAggregatedGameData.currentTurn
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