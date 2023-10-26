import { GameStatus } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { UpdateTurnCommand, UpdateTurnCommandHandler } from "../../src/commands";
import { TurnUpdatedEvent } from "../../src/events";
import { buildMockGameData, mockAskMove, mockCallMove, mockTransferMove } from "../mockdata";

describe( "UpdateTurnCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS );

	it( "should do nothing on a successful ask", async () => {
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand( mockGameData.currentTurn, mockAskMove, mockGameData.players );

		const updatedTurn = await handler.execute( command );

		expect( updatedTurn ).toEqual( mockAskMove.data.by );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update turn to asked player on unsuccessful ask", async () => {
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand(
			mockGameData.currentTurn,
			{ ...mockAskMove, success: false },
			mockGameData.players
		);

		const updatedTurn = await handler.execute( command );

		expect( updatedTurn ).toEqual( mockAskMove.data.from );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAskMove.gameId },
			data: { currentTurn: updatedTurn }
		} );

		const event = new TurnUpdatedEvent( updatedTurn, mockAskMove.gameId );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should do nothing on successful call", async () => {
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand( mockGameData.currentTurn, mockCallMove, mockGameData.players );

		const updatedTurn = await handler.execute( command );

		expect( updatedTurn ).toEqual( mockCallMove.data.by );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should update turn to random player of opposite team on unsuccessful call", async () => {
		const callingPlayer = mockGameData.players[ mockCallMove.data.by ];
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand(
			mockGameData.currentTurn,
			{ ...mockCallMove, success: false },
			mockGameData.players
		);

		const updatedTurn = await handler.execute( command );

		const receivedPlayer = mockGameData.players[ updatedTurn ];
		expect( receivedPlayer.teamId ).not.toEqual( callingPlayer.teamId );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockCallMove.gameId },
			data: { currentTurn: updatedTurn }
		} );

		const event = new TurnUpdatedEvent( updatedTurn, mockAskMove.gameId );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should update turn to mentioned player on transfer turn", async () => {
		const handler = new UpdateTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateTurnCommand( mockGameData.currentTurn, mockTransferMove, mockGameData.players );

		const updatedTurn = await handler.execute( command );

		expect( updatedTurn ).toEqual( mockTransferMove.data.to );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAskMove.gameId },
			data: { currentTurn: updatedTurn }
		} );

		const event = new TurnUpdatedEvent( updatedTurn, mockAskMove.gameId );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );