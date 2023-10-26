import type { RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Constants, GameEvents } from "../../src/constants";
import { TurnUpdatedEvent, TurnUpdatedEventHandler } from "../../src/events";

describe( "TurnUpdatedEvent", () => {

	const mockRealtimeService = mockDeep<RealtimeService>();

	it( "should publish turn updated event to the room", async () => {
		const handler = new TurnUpdatedEventHandler( mockRealtimeService );
		const event = new TurnUpdatedEvent( "2", "1" );

		await handler.handle( event );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.TURN_UPDATED,
			"2"
		);
	} );

	afterEach( () => {
		mockClear( mockRealtimeService );
	} );
} );
