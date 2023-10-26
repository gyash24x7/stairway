import { GameStatus } from "@literature/types";
import type { CommandBus } from "@nestjs/cqrs";
import type { RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { UpdateStatusCommand } from "../../src/commands";
import { Constants, GameEvents } from "../../src/constants";
import { PlayerJoinedEvent, PlayerJoinedEventHandler } from "../../src/events";
import { mockPlayer1 } from "../mockdata";

describe( "PlayerJoinedEvent", () => {

	const mockCommandBus = mockDeep<CommandBus>();
	const mockRealtimeService = mockDeep<RealtimeService>();

	it( "should publish Player joined event to the game room", async () => {
		const handler = new PlayerJoinedEventHandler( mockCommandBus, mockRealtimeService );
		const event = new PlayerJoinedEvent( "1", mockPlayer1, false );

		await handler.handle( event );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.PLAYER_JOINED,
			mockPlayer1
		);
	} );

	it( "should publish Player joined event to the game room", async () => {
		const handler = new PlayerJoinedEventHandler( mockCommandBus, mockRealtimeService );
		const event = new PlayerJoinedEvent( "1", mockPlayer1, true );

		await handler.handle( event );

		const command = new UpdateStatusCommand( "1", GameStatus.PLAYERS_READY );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( command );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.PLAYER_JOINED,
			mockPlayer1
		);
	} );

	afterEach( () => {
		mockClear( mockCommandBus );
		mockClear( mockRealtimeService );
	} );
} );