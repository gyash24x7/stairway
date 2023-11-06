import type { RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Constants, GameEvents } from "../../src/constants";
import { InferencesUpdatedEvent, InferencesUpdatedEventHandler } from "../../src/events";
import { buildMockCardMappings, buildMockInferenceData } from "../mockdata";

describe( "InferencesUpdatedEvent", () => {

	const mockRealtimeService = mockDeep<RealtimeService>();
	const cardMappingList = buildMockCardMappings();
	const inferenceData = buildMockInferenceData( cardMappingList );

	it( "should publish inferences updated message to the players", async () => {
		const handler = new InferencesUpdatedEventHandler( mockRealtimeService );

		const event = new InferencesUpdatedEvent( "1", inferenceData );
		await handler.handle( event );

		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledTimes( 4 );
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"1",
			GameEvents.INFERENCES_UPDATED,
			inferenceData[ "1" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"2",
			GameEvents.INFERENCES_UPDATED,
			inferenceData[ "2" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"3",
			GameEvents.INFERENCES_UPDATED,
			inferenceData[ "3" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"4",
			GameEvents.INFERENCES_UPDATED,
			inferenceData[ "4" ]
		);
	} );

	afterEach( () => {
		mockClear( mockRealtimeService );
	} );
} );