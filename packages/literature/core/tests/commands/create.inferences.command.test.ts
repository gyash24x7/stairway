import { GameStatus } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CreateInferencesCommand, CreateInferencesCommandHandler } from "../../src/commands";
import { InferencesUpdatedEvent } from "../../src/events";
import { buildCardMappingData, buildHandData } from "../../src/utils";
import { buildMockCardMappings, buildMockGameData, buildMockInferenceData } from "../mockdata";

describe( "CreateInferencesCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const cardMappingList = buildMockCardMappings();
	const cardMappingData = buildCardMappingData( cardMappingList );
	const hands = buildHandData( cardMappingData );
	const inferenceData = buildMockInferenceData( cardMappingList );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED, cardMappingList );

	it( "should create inferences for each player and publish InferencesUpdatedEvent", async () => {
		const mock = mockPrisma.literature.player.update;
		Object.keys( hands ).forEach( playerId => {
			mock.mockResolvedValueOnce( {
				...mockGameData.players[ playerId ],
				inferences: inferenceData[ playerId ]
			} );
		} );

		const handler = new CreateInferencesCommandHandler( mockPrisma, mockEventBus );
		const command = new CreateInferencesCommand( mockGameData, hands );

		await handler.execute( command );

		expect( mock ).toHaveBeenCalledTimes( 4 );
		expect( mock ).toHaveBeenCalledWith( {
			where: { id_gameId: { id: "1", gameId: "1" } },
			data: {
				inferences: inferenceData[ "1" ]
			}
		} );
		expect( mock ).toHaveBeenCalledWith( {
			where: { id_gameId: { id: "2", gameId: "1" } },
			data: {
				inferences: inferenceData[ "2" ]
			}
		} );
		expect( mock ).toHaveBeenCalledWith( {
			where: { id_gameId: { id: "3", gameId: "1" } },
			data: {
				inferences: inferenceData[ "3" ]
			}
		} );
		expect( mock ).toHaveBeenCalledWith( {
			where: { id_gameId: { id: "4", gameId: "1" } },
			data: {
				inferences: inferenceData[ "4" ]
			}
		} );

		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 1 );
		const event = new InferencesUpdatedEvent( "1", inferenceData );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );

	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );
} );