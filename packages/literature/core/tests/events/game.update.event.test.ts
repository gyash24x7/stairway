import { expect, test } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { QueryBus } from "@nestjs/cqrs";
import type { RealtimeService } from "@s2h/core";
import { GameUpdateEvent, GameUpdateEventHandler } from "../../src/events";
import { buildMockAggregatedGameData, mockAuthInfo } from "../mockdata";
import { GameStatus, PlayerSpecificGameData } from "@literature/data";
import { PlayerSpecificGameQuery } from "../../src/queries";

test( "When GameUpdateEvent is published, update should be sent to all the players", async () => {
	const mockPlayerSpecificGameData = mockDeep<PlayerSpecificGameData>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockQueryBus = mockDeep<QueryBus>();
	mockQueryBus.execute.mockResolvedValue( mockPlayerSpecificGameData );

	const gameUpdateEventHandler = new GameUpdateEventHandler( mockQueryBus, mockRealtimeService );
	const currentGame = buildMockAggregatedGameData( GameStatus.IN_PROGRESS );
	await gameUpdateEventHandler.handle( new GameUpdateEvent( currentGame, mockAuthInfo ) );

	expect( mockQueryBus.execute ).toHaveBeenCalledTimes( 4 );
	expect( mockQueryBus.execute ).toHaveBeenCalledWith( new PlayerSpecificGameQuery( currentGame, mockAuthInfo.id ) );
	expect( mockRealtimeService.publishDirectMessage ).toHaveBeenCalledTimes( 4 );
	expect( mockRealtimeService.publishDirectMessage ).toHaveBeenCalledWith(
		"literature",
		expect.stringContaining( currentGame.id ),
		mockPlayerSpecificGameData
	);
} );