import { CardSet } from "@common/cards";
import type { HttpException } from "@common/core";
import type { LiteratureRepository } from "@common/data";
import type { CallSetInput, CardMapping, JoinGameInput } from "@literature/data";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Messages } from "../src/literature.constants";
import { LiteratureValidators } from "../src/literature.validators";
import {
	buildCardsData,
	buildMockGameData,
	buildMockRawGameData,
	buildPlayerSpecificData,
	deck,
	mockAskCardInput,
	mockAuthUser,
	mockCallMove,
	mockCallSetInput,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockPlayerIds,
	mockTransferMove,
	mockTransferTurnInput as mockInput
} from "./mock-utils";

const mockRepository = mockDeep<LiteratureRepository>();

describe( "LiteratureValidators::joinGame", () => {

	const mockInput: JoinGameInput = { code: "BCDEDIT" };
	const mockGame = buildMockRawGameData( "CREATED" );

	it( "should throw error if game not there", async () => {
		mockRepository.getGameByCode.mockResolvedValue( undefined );

		const validators = new LiteratureValidators( mockRepository );
		const input = { input: mockInput, authUser: mockAuthUser };

		expect.assertions( 3 );
		await validators.joinGame( input ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toEqual( 404 );
			expect( err.message ).toEqual( Messages.GAME_NOT_FOUND );
			expect( mockRepository.getGameByCode ).toHaveBeenCalledWith( mockInput.code );
		} );
	} );

	it( "should throw error if game has enough players", async () => {
		mockRepository.getGameByCode.mockResolvedValue( {
			...mockGame,
			players: [ mockPlayer2, mockPlayer3, mockPlayer4, { ...mockPlayer1, id: "5" } ]
		} );

		const validators = new LiteratureValidators( mockRepository );
		const input = { input: mockInput, authUser: { ...mockAuthUser, id: "1" } };

		expect.assertions( 3 );
		await validators.joinGame( input ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toEqual( 400 );
			expect( err.message ).toEqual( Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS );
			expect( mockRepository.getGameByCode ).toHaveBeenCalledWith( mockInput.code );
		} );
	} );

	it( "should return the game and user if player already part of game", async () => {
		mockRepository.getGameByCode.mockResolvedValue( mockGame );

		const input = { input: mockInput, authUser: mockAuthUser };
		const validators = new LiteratureValidators( mockRepository );
		const { game, isUserAlreadyInGame } = await validators.joinGame( input );

		expect( isUserAlreadyInGame ).toBeTruthy();
		expect( game.players ).toEqual( [
			{ ...mockPlayer1, teamId: null },
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		] );
		expect( mockRepository.getGameByCode ).toHaveBeenCalledWith( mockInput.code );
	} );

	it( "should return the game and even if user is not part of game", async () => {
		mockRepository.getGameByCode.mockResolvedValue( {
			...mockGame,
			playerCount: 6,
			players: [
				{ ...mockPlayer2, teamId: null },
				{ ...mockPlayer3, teamId: null },
				{ ...mockPlayer4, teamId: null }
			]
		} );

		const input = { input: mockInput, authUser: mockAuthUser };
		const validators = new LiteratureValidators( mockRepository );
		const { game, isUserAlreadyInGame } = await validators.joinGame( input );

		expect( isUserAlreadyInGame ).toBeFalsy();
		expect( game.players ).toEqual( [
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		] );
		expect( mockRepository.getGameByCode ).toHaveBeenCalledWith( mockInput.code );
	} );

	afterEach( () => {
		mockClear( mockRepository );
	} );

} );

describe( "LiteratureValidators::createTeams", () => {

	const mockGameData = buildMockGameData( "PLAYERS_READY" );

	it( "should throw error if playerCount is less than required", async () => {
		const validators = new LiteratureValidators( mockRepository );

		expect.assertions( 2 );
		validators.createTeams( { ...mockGameData, playerCount: 6 } ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toEqual( 400 );
			expect( err.message ).toEqual( Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS );
		} );
	} );

	it( "should do nothing if valid", async () => {
		const validators = new LiteratureValidators( mockRepository );
		expect.assertions( 0 );
		await validators.createTeams( mockGameData );
	} );
} );

describe( "LiteratureValidators::askCard", () => {

	const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
		if ( card.id === mockAskCardInput.askedFor ) {
			return { cardId: card.id, playerId: mockPlayer2.id, gameId: "1" };
		}
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	const cardsData = buildCardsData( cardMappingList );

	const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
	const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

	it( "should throw error if asked player is not part of game", async () => {
		const validators = new LiteratureValidators( mockRepository );
		const input = {
			gameData: mockGameData,
			playerData: mockPlayerSpecificData,
			cardsData,
			input: { ...mockAskCardInput, askedFrom: "5" }
		};

		expect.assertions( 2 );
		await validators.askCard( input ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.PLAYER_NOT_PART_OF_GAME );
		} );
	} );

	it( "should throw error if asked card is with current player ", async () => {
		const validators = new LiteratureValidators( mockRepository );
		const input = {
			gameData: { ...mockGameData, currentTurn: mockPlayer2.id },
			playerData: { ...mockPlayerSpecificData, id: mockPlayer2.id },
			cardsData,
			input: mockAskCardInput
		};

		expect.assertions( 2 );
		await validators.askCard( input ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.ASKED_CARD_WITH_ASKING_PLAYER );
		} );
	} );

	it( "should throw error if asked player from same team", async () => {
		const validators = new LiteratureValidators( mockRepository );
		const input = {
			gameData: mockGameData,
			playerData: mockPlayerSpecificData,
			cardsData,
			input: { ...mockAskCardInput, askedFrom: mockPlayer3.id }
		};

		expect.assertions( 2 );
		await validators.askCard( input ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( err.message ).toBe( Messages.ASKED_PLAYER_FROM_SAME_TEAM );
		} );
	} );

	it( "should return the askedPlayer and playerWithTheAskedCard when valid", async () => {
		const validators = new LiteratureValidators( mockRepository );
		const input = {
			gameData: mockGameData,
			playerData: mockPlayerSpecificData,
			cardsData,
			input: mockAskCardInput
		};

		const result = await validators.askCard( input );

		expect( result.askedPlayer.id ).toBe( mockPlayer2.id );
		expect( result.playerWithAskedCard.id ).toBe( mockPlayer2.id );
	} );
} );

describe( "LiteratureValidators::callSet", () => {

	it( "should throw error if unknown players are mentioned in call", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockCallSetInput.data[ card.id ] === mockPlayer1.id
					? mockPlayer2.id
					: mockCallSetInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const validators = new LiteratureValidators( mockRepository );
		const callSetInput: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3",
				EightOfClubs: "5"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const input = { input: callSetInput, gameData: mockGameData, cardsData, playerData: mockPlayerSpecificData };

		expect.assertions( 2 );
		await validators.callSet( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.PLAYER_NOT_PART_OF_GAME );
			} );
	} );

	it( "should throw error if calling player doesn't call his own cards", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockCallSetInput.data[ card.id ] === mockPlayer1.id
					? mockPlayer2.id
					: mockCallSetInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const validators = new LiteratureValidators( mockRepository );
		const callSetInput: CallSetInput = {
			data: {
				AceOfClubs: "3",
				TwoOfClubs: "3",
				ThreeOfClubs: "3",
				FourOfClubs: "3",
				FiveOfClubs: "3",
				EightOfClubs: "4"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const input = { input: callSetInput, gameData: mockGameData, cardsData, playerData: mockPlayerSpecificData };

		expect.assertions( 2 );
		await validators.callSet( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.DIDNT_CALL_OWN_CARDS );
			} );
	} );

	it( "should throw error if multiple sets are called", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockCallSetInput.data[ card.id ] === mockPlayer1.id
					? mockPlayer2.id
					: mockCallSetInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const validators = new LiteratureValidators( mockRepository );
		const callSetInput: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3",
				EightOfClubs: "4"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const input = { input: callSetInput, gameData: mockGameData, cardsData, playerData: mockPlayerSpecificData };

		expect.assertions( 2 );
		await validators.callSet( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.MULTIPLE_SETS_CALLED );
			} );
	} );

	it( "should throw error if calling player doesn't have cards of that set", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockCallSetInput.data[ card.id ] === mockPlayer1.id
					? mockPlayer2.id
					: mockCallSetInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const validators = new LiteratureValidators( mockRepository );

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const input = {
			input: mockCallSetInput,
			gameData: mockGameData,
			cardsData,
			playerData: mockPlayerSpecificData
		};

		expect.assertions( 2 );
		await validators.callSet( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.SET_CALLED_WITHOUT_CARDS );
			} );
	} );

	it( "should throw error if players from multiple teams are called", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockCallSetInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const validators = new LiteratureValidators( mockRepository );
		const callSetInput: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3",
				SixOfClubs: "4"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const input = { input: callSetInput, gameData: mockGameData, cardsData, playerData: mockPlayerSpecificData };

		expect.assertions( 2 );
		await validators.callSet( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.SET_CALLED_FROM_MULTIPLE_TEAMS );
			} );
	} );

	it( "should throw error if all cards of set are not called", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockCallSetInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const validators = new LiteratureValidators( mockRepository );
		const callSetInput: CallSetInput = {
			data: {
				AceOfClubs: "1",
				TwoOfClubs: "1",
				ThreeOfClubs: "1",
				FourOfClubs: "3",
				FiveOfClubs: "3"
			}
		};

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const input = { input: callSetInput, gameData: mockGameData, cardsData, playerData: mockPlayerSpecificData };

		expect.assertions( 2 );
		await validators.callSet( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.ALL_CARDS_NOT_CALLED );
			} );
	} );

	it( "should return the correct call and called set if valid", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => {
			const playerId = card.set === CardSet.LOWER_CLUBS
				? mockCallSetInput.data[ card.id ]
				: mockPlayerIds[ index % 4 ];
			return { cardId: card.id, playerId, gameId: "1" };
		} );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );
		const input = {
			input: mockCallSetInput,
			gameData: mockGameData,
			cardsData,
			playerData: mockPlayerSpecificData
		};

		const validators = new LiteratureValidators( mockRepository );
		const { correctCall, calledSet } = await validators.callSet( input );

		expect( correctCall ).toEqual( mockCallSetInput.data );
		expect( calledSet ).toEqual( CardSet.LOWER_CLUBS );
	} );
} );

describe( "LiteratureValidators::transferTurn", () => {

	it( "should throw error if last move was not a call set", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList, [ mockTransferMove ] );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const validators = new LiteratureValidators( mockRepository );
		const input = {
			input: { transferTo: mockPlayer2.id },
			cardsData,
			gameData: mockGameData,
			playerData: mockPlayerSpecificData
		};

		expect.assertions( 2 );
		await validators.transferTurn( input )
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
			"IN_PROGRESS",
			cardMappingList,
			[ { ...mockCallMove, success: false } ]
		);

		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const validators = new LiteratureValidators( mockRepository );
		const input = {
			input: { transferTo: mockPlayer2.id },
			cardsData,
			gameData: mockGameData,
			playerData: mockPlayerSpecificData
		};

		expect.assertions( 2 );
		await validators.transferTurn( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			} );
	} );

	it( "should throw error if receiving player is not part of the game", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList, [ mockCallMove ] );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const validators = new LiteratureValidators( mockRepository );
		const input = {
			input: { transferTo: "5" },
			cardsData,
			gameData: mockGameData,
			playerData: mockPlayerSpecificData
		};

		expect.assertions( 2 );
		await validators.transferTurn( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.PLAYER_NOT_PART_OF_GAME );
			} );
	} );

	it( "should throw error if receiving player has no cards", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: [ "1", "2", "4" ][ index % 3 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList, [ mockCallMove ] );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const validators = new LiteratureValidators( mockRepository );
		const input = { input: mockInput, cardsData, gameData: mockGameData, playerData: mockPlayerSpecificData };

		expect.assertions( 2 );
		await validators.transferTurn( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			} );
	} );

	it( "should throw error if receiving player is not on the same team", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList, [ mockCallMove ] );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const validators = new LiteratureValidators( mockRepository );
		const input = {
			input: { transferTo: mockPlayer2.id },
			cardsData,
			gameData: mockGameData,
			playerData: mockPlayerSpecificData
		};

		expect.assertions( 2 );
		await validators.transferTurn( input )
			.catch( ( error: HttpException ) => {
				expect( error.getStatus() ).toEqual( 400 );
				expect( error.message ).toEqual( Messages.TRANSFER_TO_OPPONENT_TEAM );
			} );
	} );

	it( "should return transferringPlayer and receivingPlayer when valid transfer move", async () => {
		const cardMappingList: CardMapping[] = deck.map( ( card, index ) => (
			{ cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" }
		) );

		const mockGameData = buildMockGameData( "IN_PROGRESS", cardMappingList, [ mockCallMove ] );
		const cardsData = buildCardsData( cardMappingList );
		const mockPlayerSpecificData = buildPlayerSpecificData( mockPlayer1, cardMappingList );

		const validators = new LiteratureValidators( mockRepository );
		const input = { input: mockInput, cardsData, gameData: mockGameData, playerData: mockPlayerSpecificData };

		const { transferringPlayer, receivingPlayer } = await validators.transferTurn( input );

		expect( receivingPlayer.id ).toEqual( mockInput.transferTo );
		expect( transferringPlayer.id ).toEqual( mockAuthUser.id );
	} );

} );