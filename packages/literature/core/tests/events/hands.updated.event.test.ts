import { GameStatus } from "@literature/types";
import type { RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Constants, GameEvents } from "../../src/constants";
import { HandsUpdatedEvent, HandsUpdatedEventHandler } from "../../src/events";
import { buildCardMappingData, buildHandData } from "../../src/utils";
import { buildMockCardMappings, buildMockGameData } from "../mockdata";

describe( "HandsUpdatedEvent", () => {

	const mockRealtimeService = mockDeep<RealtimeService>();
	const cardMappingData = buildCardMappingData( buildMockCardMappings() );
	const hands = buildHandData( cardMappingData );
	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED );

	it( "should publish hand updated message to the players", async () => {
		const handler = new HandsUpdatedEventHandler( mockRealtimeService );

		const event = new HandsUpdatedEvent( mockGameData.id, hands );
		await handler.handle( event );

		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledTimes( 4 );
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"1",
			GameEvents.HAND_UPDATED,
			hands[ "1" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"2",
			GameEvents.HAND_UPDATED,
			hands[ "2" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"3",
			GameEvents.HAND_UPDATED,
			hands[ "3" ]
		);
		expect( mockRealtimeService.publishMemberMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			"4",
			GameEvents.HAND_UPDATED,
			hands[ "4" ]
		);
		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.CARD_COUNT_UPDATED,
			{ "1": 12, "2": 12, "3": 12, "4": 12 }
		);
	} );

	afterEach( () => {
		mockClear( mockRealtimeService );
	} );
} );