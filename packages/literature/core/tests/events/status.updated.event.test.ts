import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { RealtimeService } from "@s2h/core";
import { StatusUpdatedEvent, StatusUpdatedEventHandler } from "../../src/events";
import { GameStatus } from "@literature/types";
import { Constants, GameEvents } from "../../src/constants";

describe( "StatusUpdatedEvent", () => {

	const mockRealtimeService = mockDeep<RealtimeService>();

	it( "should publish status updated event to the room", async () => {
		const handler = new StatusUpdatedEventHandler( mockRealtimeService );
		const event = new StatusUpdatedEvent( "1", GameStatus.IN_PROGRESS );

		await handler.handle( event );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.STATUS_UPDATED,
			GameStatus.IN_PROGRESS
		);
	} );

	afterEach( () => {
		mockClear( mockRealtimeService );
	} );
} );
