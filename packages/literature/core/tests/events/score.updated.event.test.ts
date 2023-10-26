import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { CommandBus } from "@nestjs/cqrs";
import type { RealtimeService } from "@s2h/core";
import { ScoreUpdatedEvent, ScoreUpdatedEventHandler } from "../../src/events";
import { buildMockGameData, mockTeamA } from "../mockdata";
import { Constants, GameEvents } from "../../src/constants";
import { GameStatus, ScoreUpdate } from "@literature/types";
import { UpdateStatusCommand } from "../../src/commands";
import { CARD_SETS, CardSet } from "@s2h/cards";

describe( "ScoreUpdatedEvent", () => {

	const mockCommandBus = mockDeep<CommandBus>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS );
	const mockScoreUpdate: ScoreUpdate = {
		teamId: mockTeamA.id,
		score: 6,
		setWon: CardSet.LOWER_CLUBS
	};

	it( "should publish Score Update event to the game room", async () => {
		const handler = new ScoreUpdatedEventHandler( mockCommandBus, mockRealtimeService );
		const event = new ScoreUpdatedEvent( mockGameData.id, mockGameData.teams, mockScoreUpdate );

		await handler.handle( event );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.SCORE_UPDATED,
			mockScoreUpdate
		);
	} );

	it( "should publish score updated event to the game room and complete game if all sets done", async () => {
		mockGameData.teams[ mockTeamA.id ].setsWon = [ ...CARD_SETS.slice( 1 ) ];
		const handler = new ScoreUpdatedEventHandler( mockCommandBus, mockRealtimeService );
		const event = new ScoreUpdatedEvent( mockGameData.id, mockGameData.teams, mockScoreUpdate );

		await handler.handle( event );

		const command = new UpdateStatusCommand( "1", GameStatus.COMPLETED );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( command );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.SCORE_UPDATED,
			mockScoreUpdate
		);
	} );

	afterEach( () => {
		mockClear( mockCommandBus );
		mockClear( mockRealtimeService );
	} );
} );