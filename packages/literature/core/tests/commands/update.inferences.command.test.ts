import { GameStatus } from "@literature/types";
import type { EventBus, QueryBus } from "@nestjs/cqrs";
import { getPlayingCardFromId } from "@s2h/cards";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { UpdateInferenceCommand, UpdateInferenceCommandHandler } from "../../src/commands";
import { InferenceUpdatedEvent } from "../../src/events";
import { InferenceDataQuery } from "../../src/queries";
import {
	buildMockCardMappings,
	buildMockGameData,
	buildMockInferenceData,
	mockAskMove,
	mockCallMove,
	mockTransferMove
} from "../mockdata";

describe( "UpdateInferencesCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockQueryBus = mockDeep<QueryBus>();
	const mockEventBus = mockDeep<EventBus>();
	const mockCardMappingList = buildMockCardMappings();
	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, mockCardMappingList );
	const mockInferenceData = buildMockInferenceData( mockGameData.id, mockCardMappingList );

	mockQueryBus.execute.mockResolvedValue( mockInferenceData );

	it( "should updated inferences for all players on successful ask", async () => {
		const handler = new UpdateInferenceCommandHandler( mockPrisma, mockQueryBus, mockEventBus );
		const command = new UpdateInferenceCommand( mockAskMove, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockQueryBus.execute ).toHaveBeenCalledWith( new InferenceDataQuery( mockAskMove.gameId ) );

		expect( mockPrisma.literature.inference.update ).toHaveBeenCalledTimes( mockGameData.playerCount );
		Object.keys( mockGameData.players ).map( playerId => {
			const { actualCardLocations } = updatedInferences[ playerId ];
			expect( actualCardLocations[ mockAskMove.data.card ] ).toEqual( mockAskMove.data.by );
			expect( mockPrisma.literature.inference.update ).toHaveBeenCalledWith( {
				where: { gameId_playerId: { playerId, gameId: mockAskMove.gameId } },
				data: updatedInferences[ playerId ]
			} );
		} );

		const event = new InferenceUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should update inferences for all players on unsuccessful ask", async () => {
		const handler = new UpdateInferenceCommandHandler( mockPrisma, mockQueryBus, mockEventBus );
		const command = new UpdateInferenceCommand( { ...mockAskMove, success: false }, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockQueryBus.execute ).toHaveBeenCalledWith( new InferenceDataQuery( mockAskMove.gameId ) );

		expect( mockPrisma.literature.inference.update ).toHaveBeenCalledTimes( mockGameData.playerCount );
		Object.keys( mockGameData.players ).map( playerId => {
			const { possibleCardLocations } = updatedInferences[ playerId ];
			if ( !!possibleCardLocations[ mockAskMove.data.card ] ) {
				expect( possibleCardLocations[ mockAskMove.data.card ] ).not.toContainEqual( mockAskMove.data.by );
				expect( possibleCardLocations[ mockAskMove.data.card ] ).not.toContainEqual( mockAskMove.data.from );
			}
			expect( mockPrisma.literature.inference.update ).toHaveBeenCalledWith( {
				where: { gameId_playerId: { playerId, gameId: mockAskMove.gameId } },
				data: updatedInferences[ playerId ]
			} );
		} );

		const event = new InferenceUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should remove inferences for the called set for all players on call", async () => {
		const handler = new UpdateInferenceCommandHandler( mockPrisma, mockQueryBus, mockEventBus );
		const command = new UpdateInferenceCommand( mockCallMove, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockQueryBus.execute ).toHaveBeenCalledWith( new InferenceDataQuery( mockAskMove.gameId ) );

		const cardsOfCalledSetInInference = Object.values( updatedInferences )
			.flatMap( inference => [
				...Object.keys( inference.possibleCardLocations ),
				...Object.keys( inference.actualCardLocations ),
				...Object.keys( inference.inferredCardLocations )
			] )
			.map( getPlayingCardFromId )
			.filter( card => card.set === mockCallMove.data.cardSet );

		expect( cardsOfCalledSetInInference ).toHaveLength( 0 );
		expect( mockPrisma.literature.inference.update ).toHaveBeenCalledTimes( mockGameData.playerCount );

		Object.keys( mockGameData.players ).map( playerId => {
			expect( mockPrisma.literature.inference.update ).toHaveBeenCalledWith( {
				where: { gameId_playerId: { playerId, gameId: mockAskMove.gameId } },
				data: updatedInferences[ playerId ]
			} );
		} );

		const event = new InferenceUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should do nothing if the move is a transfer move", async () => {
		const handler = new UpdateInferenceCommandHandler( mockPrisma, mockQueryBus, mockEventBus );
		const command = new UpdateInferenceCommand( mockTransferMove, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockQueryBus.execute ).toHaveBeenCalledWith( new InferenceDataQuery( mockAskMove.gameId ) );

		expect( updatedInferences ).toEqual( mockInferenceData );
		expect( mockPrisma.literature.player.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockQueryBus );
		mockClear( mockEventBus );
	} );

} );