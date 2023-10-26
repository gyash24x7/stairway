import { GameStatus } from "@literature/types";
import type { CommandBus } from "@nestjs/cqrs";
import type { RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CreateInferencesCommand, UpdateStatusCommand } from "../../src/commands";
import { Constants, GameEvents } from "../../src/constants";
import { GameStartedEvent, GameStartedEventHandler } from "../../src/events";
import { buildCardMappingData, buildHandData } from "../../src/utils";
import { buildMockCardMappings, buildMockGameData } from "../mockdata";

describe( "GameStartedEvent", () => {

	const mockCommandBus = mockDeep<CommandBus>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const cardMappingData = buildCardMappingData( buildMockCardMappings() );
	const hands = buildHandData( cardMappingData );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED );


	it( "should create inferences, update status and publish hand updated message to the players", async () => {
		const handler = new GameStartedEventHandler( mockCommandBus, mockRealtimeService );

		const event = new GameStartedEvent( mockGameData, cardMappingData );
		await handler.handle( event );

		const createInferencesCommand = new CreateInferencesCommand( mockGameData, hands );
		const updateStatusCommand = new UpdateStatusCommand( "1", GameStatus.IN_PROGRESS );

		expect( mockCommandBus.execute ).toHaveBeenCalledTimes( 2 );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( updateStatusCommand );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( createInferencesCommand );

		expect( mockRealtimeService.publishDirectMessage ).toHaveBeenCalledTimes( 4 );
		expect( mockRealtimeService.publishDirectMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"1",
			GameEvents.HAND_UPDATED,
			hands[ "1" ]
		);
		expect( mockRealtimeService.publishDirectMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"2",
			GameEvents.HAND_UPDATED,
			hands[ "2" ]
		);
		expect( mockRealtimeService.publishDirectMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"3",
			GameEvents.HAND_UPDATED,
			hands[ "3" ]
		);
		expect( mockRealtimeService.publishDirectMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"4",
			GameEvents.HAND_UPDATED,
			hands[ "4" ]
		);
	} );

	afterEach( () => {
		mockClear( mockCommandBus );
		mockClear( mockRealtimeService );
	} );
} );