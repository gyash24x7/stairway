import { CardMapping, GameStatus, MoveType } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { TransferTurnCommand, TransferTurnCommandHandler } from "../../src/commands";
import { MoveCreatedEvent } from "../../src/events";
import { buildCardMappingData } from "../../src/utils";
import type { TransferTurnValidator } from "../../src/validators";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockAuthInfo,
	mockCallMove,
	mockPlayer1,
	mockPlayer3,
	mockPlayerIds,
	mockTransferMove,
	mockTransferTurnInput as mockInput
} from "../mockdata";

describe( "TransferTurnCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const mockValidator = mockDeep<TransferTurnValidator>();

	it( "should transfer turn to another player", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);

		mockPrisma.literature.move.create.mockResolvedValue( mockTransferMove );
		mockValidator.validate.mockResolvedValue( { transferringPlayer: mockPlayer1, receivingPlayer: mockPlayer3 } );

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const handler = new TransferTurnCommandHandler( mockPrisma, mockValidator, mockEventBus );
		const command = new TransferTurnCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		const result = await handler.execute( command );

		expect( result ).toEqual( mockTransferMove );
		expect( mockPrisma.literature.move.create ).toHaveBeenCalledTimes( 1 );
		expect( mockPrisma.literature.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockGameData.id,
				type: MoveType.TRANSFER_TURN,
				success: true,
				data: {
					to: mockInput.transferTo,
					from: mockAuthInfo.id
				},
				description: `${ mockPlayer1.name } transferred the turn to ${ mockPlayer3.name }`
			}
		} );
		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new MoveCreatedEvent( mockTransferMove, mockGameData, cardMappingData ) );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
		mockClear( mockValidator );
	} );
} );