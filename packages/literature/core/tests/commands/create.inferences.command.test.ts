import { GameStatus } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CreateInferenceCommand, CreateInferenceCommandHandler } from "../../src/commands";
import { InferenceUpdatedEvent } from "../../src/events";
import { buildMockCardMappings, buildMockGameData, buildMockInferenceData } from "../mockdata";
import { buildCardsData } from "../mockdata/utils";

describe( "CreateInferencesCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const cardMappingList = buildMockCardMappings();
	const { hands } = buildCardsData( cardMappingList );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED, cardMappingList );
	const inferenceData = buildMockInferenceData( mockGameData.id, cardMappingList );

	it( "should create inferences for each player and publish InferenceUpdatedEvent", async () => {
		const mock = mockPrisma.literature.inference.create;
		Object.keys( hands ).forEach( playerId => {
			mock.mockResolvedValueOnce( inferenceData[ playerId ] );
		} );

		const handler = new CreateInferenceCommandHandler( mockPrisma, mockEventBus );
		const command = new CreateInferenceCommand( mockGameData, hands );

		await handler.execute( command );

		expect( mock ).toHaveBeenCalledTimes( 4 );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "1" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "2" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "3" ] } );
		expect( mock ).toHaveBeenCalledWith( { data: inferenceData[ "4" ] } );

		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 1 );
		const event = new InferenceUpdatedEvent( "1", inferenceData );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );

	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );
} );