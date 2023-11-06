import { CardInferences, GameStatus, InferenceData } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import { getPlayingCardFromId } from "@s2h/cards";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { UpdateInferencesCommand, UpdateInferencesCommandHandler } from "../../src/commands";
import { InferencesUpdatedEvent } from "../../src/events";
import { buildMockGameData, mockAskMove, mockCallMove, mockTransferMove } from "../mockdata";

describe( "UpdateInferencesCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS );

	it( "should updated inferences for all players on successful ask", async () => {
		const handler = new UpdateInferencesCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateInferencesCommand( mockAskMove, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockPrisma.literature.player.update ).toHaveBeenCalledTimes( mockGameData.playerCount );
		Object.keys( mockGameData.players ).map( playerId => {
			expect( updatedInferences[ playerId ][ mockAskMove.data.card ] ).toEqual( [ mockAskMove.data.by ] );
			expect( mockPrisma.literature.player.update ).toHaveBeenCalledWith( {
				where: { id_gameId: { id: playerId, gameId: mockAskMove.gameId } },
				data: { inferences: updatedInferences[ playerId ] }
			} );
		} );

		const event = new InferencesUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should update inferences for all players on unsuccessful ask", async () => {
		const handler = new UpdateInferencesCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateInferencesCommand( { ...mockAskMove, success: false }, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		expect( mockPrisma.literature.player.update ).toHaveBeenCalledTimes( mockGameData.playerCount );
		Object.keys( mockGameData.players ).map( playerId => {
			const inferencesForPlayer = updatedInferences[ playerId ];
			expect( inferencesForPlayer[ mockAskMove.data.card ] ).not.toContainEqual( mockAskMove.data.by );
			expect( inferencesForPlayer[ mockAskMove.data.card ] ).not.toContainEqual( mockAskMove.data.from );
			expect( mockPrisma.literature.player.update ).toHaveBeenCalledWith( {
				where: { id_gameId: { id: playerId, gameId: mockAskMove.gameId } },
				data: { inferences: updatedInferences[ playerId ] }
			} );
		} );

		const event = new InferencesUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should remove inferences for the called set for all players on call", async () => {
		const handler = new UpdateInferencesCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateInferencesCommand( mockCallMove, mockGameData.players );

		const updatedInferences = await handler.execute( command );

		const remainingCardsInInferences = Object.values( updatedInferences )
			.flatMap( cardInferences => Object.keys( cardInferences ).map( getPlayingCardFromId ) )
			.filter( card => card.set === mockCallMove.data.cardSet );

		expect( remainingCardsInInferences ).toHaveLength( 0 );
		expect( mockPrisma.literature.player.update ).toHaveBeenCalledTimes( mockGameData.playerCount );

		Object.keys( mockGameData.players ).map( playerId => {
			expect( mockPrisma.literature.player.update ).toHaveBeenCalledWith( {
				where: { id_gameId: { id: playerId, gameId: mockCallMove.gameId } },
				data: { inferences: updatedInferences[ playerId ] }
			} );
		} );

		const event = new InferencesUpdatedEvent( mockAskMove.gameId, updatedInferences );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should do nothing if the move is a transfer move", async () => {
		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS );
		const handler = new UpdateInferencesCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateInferencesCommand( mockTransferMove, mockGameData.players );

		const inferenceData: InferenceData = {};
		Object.values( mockGameData.players ).map( player => {
			inferenceData[ player.id ] = { ...player.inferences as CardInferences };
		} );

		const updatedInferences = await handler.execute( command );

		expect( updatedInferences ).toEqual( inferenceData );
		expect( mockPrisma.literature.player.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );