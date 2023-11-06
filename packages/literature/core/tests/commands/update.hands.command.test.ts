import type { EventBus } from "@nestjs/cqrs";
import { getPlayingCardFromId } from "@s2h/cards";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { UpdateHandsCommand, UpdateHandsCommandHandler } from "../../src/commands";
import { HandsUpdatedEvent } from "../../src/events";
import { buildCardMappingData } from "../../src/utils";
import { buildMockCardMappings, mockAskMove, mockCallMove } from "../mockdata";

describe( "UpdateHandsCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const cardMappingList = buildMockCardMappings();
	const cardMappingData = buildCardMappingData( cardMappingList );

	it( "should transfer the card to the player who asked for it on successful ask", async () => {
		cardMappingData[ mockAskMove.data.card ] = mockAskMove.data.from;
		const card = getPlayingCardFromId( mockAskMove.data.card );

		const handler = new UpdateHandsCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateHandsCommand( mockAskMove, cardMappingData );

		const updatedHands = await handler.execute( command );

		expect( updatedHands[ mockAskMove.data.by ] ).toContainEqual( card );
		expect( updatedHands[ mockAskMove.data.from ] ).not.toContainEqual( card );

		expect( mockPrisma.literature.cardMapping.update ).toHaveBeenCalledWith( {
			where: { cardId_gameId: { gameId: mockAskMove.gameId, cardId: mockAskMove.data.card } },
			data: { playerId: mockAskMove.data.by }
		} );

		const event = new HandsUpdatedEvent( mockAskMove.gameId, updatedHands );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should do nothing on unsuccessful ask", async () => {
		cardMappingData[ mockAskMove.data.card ] = mockAskMove.data.from;
		const card = getPlayingCardFromId( mockAskMove.data.card );

		const handler = new UpdateHandsCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateHandsCommand( { ...mockAskMove, success: false }, cardMappingData );

		const updatedHands = await handler.execute( command );

		expect( updatedHands[ mockAskMove.data.by ] ).not.toContainEqual( card );
		expect( updatedHands[ mockAskMove.data.from ] ).toContainEqual( card );

		expect( mockPrisma.literature.cardMapping.update ).toHaveBeenCalledTimes( 0 );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should remove the cards of that set on successful call", async () => {
		const calledSet = mockCallMove.data.cardSet;
		const handler = new UpdateHandsCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateHandsCommand( mockCallMove, cardMappingData );

		const updatedHands = await handler.execute( command );

		const allCardsOfCalledSet = Object.values( updatedHands ).flat().filter( card => card.set === calledSet );
		const calledCards = Object.keys( mockCallMove.data.correctCall );

		expect( allCardsOfCalledSet ).toHaveLength( 0 );
		expect( mockPrisma.literature.cardMapping.deleteMany ).toHaveBeenCalledWith( {
			where: { cardId: { in: calledCards } }
		} );

		const event = new HandsUpdatedEvent( mockAskMove.gameId, updatedHands );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );

	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );