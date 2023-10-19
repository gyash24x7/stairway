import { describe, expect, it } from "vitest";
import { CardMapping, GameStatus, MoveType } from "@literature/data";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "../../src/services";
import type { EventBus } from "@nestjs/cqrs";
import { TransferChanceCommand, TransferChanceCommandHandler } from "../../src/commands";
import { GameUpdateEvent, MoveCreatedEvent } from "../../src/events";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";
import {
	buildMockAggregatedGameData,
	deck,
	mockAuthInfo,
	mockCallMove,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayerIds,
	mockTransferChanceInput as mockInput,
	mockTransferMove
} from "../mockdata";

describe( "TransferChanceCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should not transfer chance to another player if last move was not a call set", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
		const mockAggregatedGameData = buildMockAggregatedGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockTransferMove ]
		);

		const handler = new TransferChanceCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferChanceCommand(
			{ transferTo: mockPlayer2.id },
			mockAggregatedGameData,
			mockAuthInfo
		);

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			} );
	} );
	it( "should not transfer chance to another player if last move was a call set but not successful", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
		const mockAggregatedGameData = buildMockAggregatedGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ { ...mockCallMove, success: false } ]
		);

		const handler = new TransferChanceCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferChanceCommand(
			{ transferTo: mockPlayer2.id },
			mockAggregatedGameData,
			mockAuthInfo
		);

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			} );
	} );

	it( "should not transfer chance to another player if receiving player is not part of the game", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
		const mockAggregatedGameData = buildMockAggregatedGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);

		const handler = new TransferChanceCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferChanceCommand( { transferTo: "5" }, mockAggregatedGameData, mockAuthInfo );

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.PLAYER_NOT_PART_OF_GAME );
			} );
	} );

	it( "should not transfer chance to another player if receiving player has no cards", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: [ "1", "2", "4" ][ index % 3 ], gameId: "1" }
		) );
		const mockAggregatedGameData = buildMockAggregatedGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);

		const handler = new TransferChanceCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferChanceCommand( mockInput, mockAggregatedGameData, mockAuthInfo );

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			} );
	} );

	it( "should not transfer chance to another player if receiving player is not on the same team", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
		const mockAggregatedGameData = buildMockAggregatedGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);

		const handler = new TransferChanceCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferChanceCommand(
			{ transferTo: mockPlayer2.id },
			mockAggregatedGameData,
			mockAuthInfo
		);

		expect.assertions( 2 );
		await handler.execute( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_TO_OPPONENT_TEAM );
			} );
	} );

	it( "should transfer chance to another player", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );
		const mockAggregatedGameData = buildMockAggregatedGameData(
			GameStatus.IN_PROGRESS,
			cardMappingList,
			[ mockCallMove ]
		);
		mockPrisma.move.create.mockResolvedValue( mockTransferMove );

		const handler = new TransferChanceCommandHandler( mockPrisma, mockEventBus );
		const command = new TransferChanceCommand( mockInput, mockAggregatedGameData, mockAuthInfo );

		const result = await handler.execute( command );

		expect( result ).toEqual( mockAggregatedGameData.id );
		expect( mockPrisma.move.create ).toHaveBeenCalledTimes( 1 );
		expect( mockPrisma.move.create ).toHaveBeenCalledWith( {
			data: {
				gameId: mockAggregatedGameData.id,
				type: MoveType.TRANSFER_CHANCE,
				success: true,
				data: {
					to: mockInput.transferTo,
					from: mockAuthInfo.id
				},
				description: `${ mockPlayer1.name } transferred the chance to ${ mockPlayer3.name }`
			}
		} );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 2 );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( new MoveCreatedEvent( mockTransferMove ) );
		expect( mockPrisma.game.update ).toHaveBeenCalledTimes( 1 );
		expect( mockPrisma.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAggregatedGameData.id },
			data: { currentTurn: mockInput.transferTo }
		} );
		expect( mockAggregatedGameData.moves ).toEqual( [ mockTransferMove, mockCallMove ] );
		expect( mockAggregatedGameData.currentTurn ).toEqual( mockInput.transferTo );
		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new GameUpdateEvent( mockAggregatedGameData, mockAuthInfo ) );

	} );
} );