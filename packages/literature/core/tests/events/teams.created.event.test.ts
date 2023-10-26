import { GameStatus, TeamData } from "@literature/types";
import type { CommandBus } from "@nestjs/cqrs";
import type { RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { UpdateStatusCommand } from "../../src/commands";
import { Constants, GameEvents } from "../../src/constants";
import { TeamsCreatedEvent, TeamsCreatedEventHandler } from "../../src/events";
import { mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4, mockTeamA, mockTeamB } from "../mockdata";

describe( "TeamsCreatedEvent", () => {

	const mockCommandBus = mockDeep<CommandBus>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const teamData: TeamData = {
		[ mockTeamA.id ]: { ...mockTeamA, members: [ mockPlayer1.id, mockPlayer3.id ] },
		[ mockTeamB.id ]: { ...mockTeamB, members: [ mockPlayer2.id, mockPlayer4.id ] }
	};

	it( "should publish teams created message to the room", async () => {
		const handler = new TeamsCreatedEventHandler( mockCommandBus, mockRealtimeService );
		const event = new TeamsCreatedEvent( "1", teamData );

		await handler.handle( event );

		const command = new UpdateStatusCommand( "1", GameStatus.TEAMS_CREATED );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( command );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.TEAMS_CREATED,
			teamData
		);
	} );

	afterEach( () => {
		mockClear( mockCommandBus );
		mockClear( mockRealtimeService );
	} );
} );
