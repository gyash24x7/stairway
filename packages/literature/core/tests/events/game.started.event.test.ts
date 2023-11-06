import { GameStatus } from "@literature/types";
import type { CommandBus, EventBus } from "@nestjs/cqrs";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CreateInferencesCommand, UpdateStatusCommand } from "../../src/commands";
import { GameStartedEvent, GameStartedEventHandler, HandsUpdatedEvent } from "../../src/events";
import { buildCardMappingData, buildHandData } from "../../src/utils";
import { buildMockCardMappings, buildMockGameData } from "../mockdata";

describe( "GameStartedEvent", () => {

	const mockCommandBus = mockDeep<CommandBus>();
	const mockEventBus = mockDeep<EventBus>();
	const cardMappingData = buildCardMappingData( buildMockCardMappings() );
	const hands = buildHandData( cardMappingData );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED );


	it( "should create inferences, update status and publish hand updated message to the players", async () => {
		const handler = new GameStartedEventHandler( mockCommandBus, mockEventBus );

		const event = new GameStartedEvent( mockGameData, cardMappingData );
		await handler.handle( event );

		const createInferencesCommand = new CreateInferencesCommand( mockGameData, hands );
		const updateStatusCommand = new UpdateStatusCommand( "1", GameStatus.IN_PROGRESS );

		expect( mockCommandBus.execute ).toHaveBeenCalledTimes( 2 );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( updateStatusCommand );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( createInferencesCommand );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( new HandsUpdatedEvent( mockGameData.id, hands ) );
	} );

	afterEach( () => {
		mockClear( mockCommandBus );
		mockClear( mockEventBus );
	} );
} );