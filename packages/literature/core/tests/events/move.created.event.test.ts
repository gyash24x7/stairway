import { GameStatus } from "@literature/types";
import type { CommandBus } from "@nestjs/cqrs";
import type { RealtimeService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { UpdateHandsCommand, UpdateInferenceCommand, UpdateScoreCommand, UpdateTurnCommand } from "../../src/commands";
import { Constants, GameEvents } from "../../src/constants/literature.constants";
import { MoveCreatedEvent, MoveCreatedEventHandler } from "../../src/events";
import { buildMockCardMappings, buildMockGameData, mockAskMove, mockCallMove } from "../mockdata";
import { buildCardsData } from "../mockdata/utils";

describe( "MoveCreatedEvent", () => {

	const mockCommandBus = mockDeep<CommandBus>();
	const mockRealtimeService = mockDeep<RealtimeService>();
	const cardMappingList = buildMockCardMappings();
	const cardsData = buildCardsData( cardMappingList );
	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList, [ mockCallMove ] );


	it( "should update hands, inferences, score and turn when move created", async () => {
		const handler = new MoveCreatedEventHandler( mockCommandBus, mockRealtimeService );

		const event = new MoveCreatedEvent( mockAskMove, mockGameData, cardsData );
		await handler.handle( event );

		const updateInferencesCommand = new UpdateInferenceCommand( mockAskMove, mockGameData.players );
		const updateHandsCommand = new UpdateHandsCommand( mockAskMove, cardsData );
		const updateScoreCommand = new UpdateScoreCommand( mockAskMove, mockGameData.players, mockGameData.teams );
		const updateTurnCommand = new UpdateTurnCommand( mockGameData.currentTurn, mockAskMove, mockGameData.players );

		expect( mockCommandBus.execute ).toHaveBeenCalledTimes( 4 );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( updateInferencesCommand );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( updateHandsCommand );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( updateScoreCommand );
		expect( mockCommandBus.execute ).toHaveBeenCalledWith( updateTurnCommand );

		expect( mockRealtimeService.publishRoomMessage ).toHaveBeenCalledWith(
			Constants.LITERATURE,
			"1",
			GameEvents.MOVE_CREATED,
			mockAskMove
		);
	} );

	afterEach( () => {
		mockClear( mockCommandBus );
		mockClear( mockRealtimeService );
	} );
} );