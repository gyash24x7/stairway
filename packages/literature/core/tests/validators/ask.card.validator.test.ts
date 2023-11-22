import { CardMapping, GameStatus } from "@literature/types";
import type { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AskCardCommand } from "../../src/commands";
import { Messages } from "../../src/constants/literature.constants";
import { AskCardValidator } from "../../src/validators";
import {
	buildMockGameData,
	buildPlayerSpecificData,
	deck,
	mockAskCardInput as mockInput,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayerIds
} from "../mockdata";
import { buildCardsData } from "../mockdata/utils";

describe( "AskCardValidator", () => {

	const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
		if ( card.id === mockInput.askedFor ) {
			return { cardId: card.id, playerId: mockPlayer2.id, gameId: "1" };
		}
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	const cardsData = buildCardsData( cardMappingList );

	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappingList );
	const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

	it( "should throw error if asked player is not part of game", async () => {
		const validator = new AskCardValidator();
		const command = new AskCardCommand(
			{ ...mockInput, askedFrom: "5" },
			mockGameData,
			mockPlayerSpecificData,
			cardsData
		);

		expect.assertions( 2 );
		await validator.validate( command ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.PLAYER_NOT_PART_OF_GAME );
		} );
	} );

	it( "should throw error if asked card is with current player ", async () => {
		const validator = new AskCardValidator();
		const command = new AskCardCommand(
			mockInput,
			mockGameData,
			{ ...mockPlayerSpecificData, id: mockPlayer2.id },
			cardsData
		);

		expect.assertions( 2 );
		await validator.validate( command ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.ASKED_CARD_WITH_ASKING_PLAYER );
		} );
	} );

	it( "should throw error if asked player from same team", async () => {
		const validator = new AskCardValidator();
		const command = new AskCardCommand(
			{ ...mockInput, askedFrom: mockPlayer3.id },
			mockGameData,
			mockPlayerSpecificData,
			cardsData
		);

		expect.assertions( 2 );
		await validator.validate( command ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.ASKED_PLAYER_FROM_SAME_TEAM );
		} );
	} );

	it( "should return the askedPlayer and playerWithTheAskedCard when valid", async () => {
		const validator = new AskCardValidator();
		const command = new AskCardCommand( mockInput, mockGameData, mockPlayerSpecificData, cardsData );
		const result = await validator.validate( command );

		expect( result.askedPlayer.id ).toBe( mockPlayer2.id );
		expect( result.playerWithAskedCard.id ).toBe( mockPlayer2.id );
	} );
} );