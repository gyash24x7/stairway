import { CardMapping, GameStatus } from "@literature/types";
import type { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { TransferTurnCommand } from "../../src/commands";
import { Messages } from "../../src/constants";
import { buildCardMappingData } from "../../src/utils";
import { TransferTurnValidator } from "../../src/validators";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockAuthInfo,
	mockCallMove,
	mockPlayer1,
	mockPlayer2,
	mockPlayerIds,
	mockTransferMove,
	mockTransferTurnInput as mockInput
} from "../mockdata";

describe( "TransferTurnValidator", () => {

	it( "should throw error if last move was not a call set", async () => {
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

		const validator = new TransferTurnValidator();
		const command = new TransferTurnCommand(
			{ transferTo: mockPlayer2.id },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			} );
	} );

	it( "should throw error if last move was a call set but not successful", async () => {
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

		const validator = new TransferTurnValidator();
		const command = new TransferTurnCommand(
			{ transferTo: mockPlayer2.id },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			} );
	} );

	it( "should throw error if receiving player is not part of the game", async () => {
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

		const validator = new TransferTurnValidator();
		const command = new TransferTurnCommand(
			{ transferTo: "5" },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.PLAYER_NOT_PART_OF_GAME );
			} );
	} );

	it( "should throw error if receiving player has no cards", async () => {
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

		const validator = new TransferTurnValidator();
		const command = new TransferTurnCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			} );
	} );

	it( "should throw error if receiving player is not on the same team", async () => {
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

		const validator = new TransferTurnValidator();
		const command = new TransferTurnCommand(
			{ transferTo: mockPlayer2.id },
			mockGameData,
			mockPlayerSpecificData,
			cardMappingData
		);

		expect.assertions( 2 );
		await validator.validate( command )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_TO_OPPONENT_TEAM );
			} );
	} );

	it( "should return transferringPlayer and receivingPlayer when valid transfer move", async () => {
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

		const validator = new TransferTurnValidator();
		const command = new TransferTurnCommand( mockInput, mockGameData, mockPlayerSpecificData, cardMappingData );

		const { transferringPlayer, receivingPlayer } = await validator.validate( command );

		expect( receivingPlayer.id ).toEqual( mockInput.transferTo );
		expect( transferringPlayer.id ).toEqual( mockAuthInfo.id );
	} );

} );