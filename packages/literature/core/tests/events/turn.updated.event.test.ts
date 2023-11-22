import type { RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Constants, GameEvents } from "../../src/constants/literature.constants";
import { TurnUpdatedEvent, TurnUpdatedEventHandler } from "../../src/events";
import { mockPlayer1 } from "../mockdata";

describe( "TurnUpdatedEvent", () => {

	const mockRealtimeService = mockDeep<RealtimeService>();

	it( "should publish turn updated event to the room", async () => {
		const handler = new TurnUpdatedEventHandler( mockRealtimeService );
		const event = new TurnUpdatedEvent( "1", "2", { "2": mockPlayer1 } );

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
