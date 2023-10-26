import { describe, expect, it } from "vitest";
import { CardMapping, GameStatus, MoveType } from "@literature/types";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import type { EventBus } from "@nestjs/cqrs";
import { TransferTurnCommand, TransferTurnCommandHandler } from "../../src/commands";
import { MoveCreatedEvent } from "../../src/events";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockAuthInfo,
	mockCallMove,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayerIds,
	mockTransferMove,
	mockTransferTurnInput as mockInput
} from "../mockdata";
import { buildCardMappingData } from "../../src/utils";

describe( "TransferTurnCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should not transfer turn to another player if last move was not a call set", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockTransferMove ]
		);

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const handler = new TransferTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferTurnCommand(
			{ transferTo: mockPlayer2.id },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			} );
	} );
	it( "should not transfer turn to another player if last move was a call set but not successful", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
		const mockGameData = buildMockGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ { ...mockCallMove, success: false } ]
		);

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const handler = new TransferTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferTurnCommand(
			{ transferTo: mockPlayer2.id },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			} );
	} );

	it( "should not transfer turn to another player if receiving player is not part of the game", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
		const mockGameData = buildMockGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const handler = new TransferTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferTurnCommand(
			{ transferTo: "5" },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.PLAYER_NOT_PART_OF_GAME );
			} );
	} );

	it( "should not transfer turn to another player if receiving player has no cards", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: [ "1", "2", "4" ][ index % 3 ], gameId: "1" }
		) );
		const mockGameData = buildMockGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const handler = new TransferTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferTurnCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			} );
	} );

	it( "should not transfer turn to another player if receiving player is not on the same team", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
		const mockGameData = buildMockGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const handler = new TransferTurnCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferTurnCommand(
			{ transferTo: mockPlayer2.id },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_TO_OPPONENT_TEAM );
			} );
	} );

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

		const cardMappingData = buildCardMappingData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const handler = new TransferTurnCommandHandler( mockPrisma, mockEventBus );
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
} );