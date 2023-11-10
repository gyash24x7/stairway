import { GameStatus } from "@literature/types";
import type { CommandBus, EventBus } from "@nestjs/cqrs";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CreateInferenceCommand, UpdateStatusCommand } from "../../src/commands";
import { GameStartedEvent, GameStartedEventHandler, HandsUpdatedEvent } from "../../src/events";
import { buildMockCardMappings, buildMockGameData } from "../mockdata";
import { buildCardsData } from "../mockdata/utils";

describe( "GameStartedEvent", () => {

	const mockCommandBus = mockDeep<CommandBus>();
	const mockEventBus = mockDeep<EventBus>();
	const cardsData = buildCardsData( buildMockCardMappings() );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED );


	it( "should create inferences, update status and publish hand updated message to the players", async () => {
		const handler = new GameStartedEventHandler( mockCommandBus, mockEventBus );

		const event = new GameStartedEvent( mockGameData, cardsData );
		await handler.handle( event );

		const createInferencesCommand = new CreateInferenceCommand( mockGameData, cardsData.hands );
		const updateStatusCommand = new UpdateStatusCommand( "1", GameStatus.IN_PROGRESS );
		const handsUpdatedEvent = new HandsUpdatedEvent( mockGameData.id, cardsData.hands );

		expect( mockCommandBus.execute ).toHaveBeenCalledTimes( 2 );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( updateStatusCommand );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( createInferencesCommand );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( handsUpdatedEvent );
	} );

	afterEach( () => {
		mockClear( mockCommandBus );
		mockClear( mockEventBus );
	} );
} );