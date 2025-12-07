import type { CardId } from "@s2h/utils/cards";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CallbreakEngine } from "../src/engine.ts";
import type { BasePlayerInfo, Bindings, GameData, PlayCardInput, PlayerId } from "../src/types.ts";
import { suggestCardToPlay, suggestDealWins } from "../src/utils.ts";

vi.mock( "cloudflare:workers", () => ( {
	DurableObject: class {
		constructor( public ctx: DurableObjectState, public env: Bindings ) { }
	}
} ) );

class MockCallbreakEngine extends CallbreakEngine {
	public setHands( hands: CardId[][] ) {
		this.data.deals[ 0 ].hands = this.data.deals[ 0 ].playerOrder.reduce(
			( acc, playerId, idx ) => {
				acc[ playerId ] = hands[ idx ];
				return acc;
			},
			{} as Record<PlayerId, CardId[]>
		);
	}

	public getTrump() {
		return this.data.trump;
	}

	public getStatus() {
		return this.data.status;
	}

	public getCurrentDeal() {
		return this.data.deals[ 0 ];
	}

	public getCurrentRound() {
		const currentDeal = this.getCurrentDeal();
		return currentDeal.rounds[ 0 ];
	}

	public setDealCount( count: number ) {
		this.data.dealCount = count;
	}

	public isBot( playerId: PlayerId ) {
		return this.data.players[ playerId ].isBot || false;
	}
}

describe( "Wordle:Engine", () => {

	const mockDurableObjectState = {
		id: { toString: () => "mock-do-id" },
		blockConcurrencyWhile: async <T>( cb: () => Promise<T> ) => cb(),
		storage: {
			setAlarm: vi.fn(),
			deleteAlarm: vi.fn()
		}
	} as unknown as DurableObjectState;

	const mockWss = {
		broadcast: vi.fn()
	};

	const mockEnv = {
		CALLBREAK_KV: {
			get: vi.fn(),
			put: vi.fn()
		},
		WSS: {
			idFromName: vi.fn(),
			get: vi.fn().mockImplementation( () => mockWss )
		}
	} as unknown as Bindings;

	const player1 = {
		id: "p1",
		name: "Player 1",
		avatar: "avatar-1",
		username: "player1"
	};

	const player2 = {
		id: "p2",
		name: "Player 2",
		avatar: "avatar-2",
		username: "player2"
	};

	const player3 = {
		id: "p3",
		name: "Player 3",
		avatar: "avatar-3",
		username: "player3"
	};

	const player4 = {
		id: "p4",
		name: "Player 4",
		avatar: "avatar-4",
		username: "player4"
	};

	const players: Record<string, BasePlayerInfo> = {
		p1: player1,
		p2: player2,
		p3: player3,
		p4: player4
	};

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "GamePlay: Exception Scenarios", () => {
		const engine = new MockCallbreakEngine( mockDurableObjectState, mockEnv );

		it.sequential( "should initialize game with default settings", async () => {
			expect( mockEnv.CALLBREAK_KV.put ).toHaveBeenCalledWith( "mock-do-id", expect.any( String ) );

			await engine.initialize( { trumpSuit: "S" }, player1.id );
			await engine.addPlayer( player1 );
			const { data } = await engine.getPlayerData( player1.id );

			expect( data ).toBeDefined();
			expect( data?.dealCount ).toBe( 5 );
			expect( data?.trump ).toBe( "S" );
		} );

		it.sequential( "should return error if player not part of game", async () => {
			const { error } = await engine.getPlayerData( "invalid-player" );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Player not in game!" );
		} );

		it.sequential( "should return game id if player tries to re-join", async () => {
			const { data, error } = await engine.addPlayer( player1 );
			expect( error ).toBeUndefined();
			expect( data ).toBeDefined();
			expect( data ).toEqual( expect.any( String ) );
		} );

		it.sequential( "should return error if non-creator tries to add bots", async () => {
			const { error } = await engine.addBots( player2 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Only the game creator can add bots!" );
		} );

		it.sequential( "should return error when more than 4 players try to join", async () => {
			await engine.addBots( player1 );

			const extraPlayer = {
				id: "p5",
				name: "Player 5",
				avatar: "avatar-5",
				username: "player5"
			};

			const { error } = await engine.addPlayer( extraPlayer );

			expect( error ).toBeDefined();
			expect( error ).toBe( "Game full!" );
		} );

		it.sequential( "should return error while adding bots when game already has 4 players", async () => {
			const { error } = await engine.addBots( player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Game already has 4 players!" );
		} );

		it.sequential( "should return error when trying to declare before deal created", async () => {
			const { error } = await engine.declareDealWins( { dealId: "deal-1", wins: 3 }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Active deal not found!" );
		} );

		it.sequential( "should return error when trying to play card before deal created", async () => {
			const { error } = await engine.playCard( { dealId: "deal-1", roundId: "round-1", cardId: "AH" }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Deal not found!" );
		} );

		it.sequential( "should create a new deal when alarm is triggered and set hands", async () => {
			engine.setDealCount( 2 );
			await engine.alarm();
			const { data } = await engine.getPlayerData( player1.id );

			expect( data ).toBeDefined();
			expect( data?.currentDeal ).toBeDefined();
			expect( data?.status ).toBe( "CARDS_DEALT" );
			expect( data?.hand?.length ).toBe( 13 );

			const hands: CardId[][] = [
				[ "AH", "10H", "7H", "6H", "AC", "QC", "10C", "5S", "3S", "QD", "10D", "6D", "2D" ],
				[ "KH", "9H", "8H", "JC", "8C", "6C", "JS", "10S", "7S", "4S", "2S", "9D", "3D" ],
				[ "JH", "5H", "KC", "9C", "7C", "AS", "KS", "AD", "KD", "JD", "8D", "7D", "5D" ],
				[ "QH", "4H", "3H", "2H", "5C", "4C", "3C", "2C", "QS", "9S", "8S", "6S", "4D" ]
			];

			engine.setHands( hands );
			const deal = engine.getCurrentDeal();

			deal.playerOrder.forEach( ( playerId, idx ) => {
				expect( deal.hands[ playerId ] ).toEqual( hands[ idx ] );
			} );
		} );

		it.sequential( "should return error when non-existent player tries to declare wins", async () => {
			const deal = engine.getCurrentDeal();
			const { error } = await engine.declareDealWins( { dealId: deal.id, wins: 2 }, player2 );

			expect( error ).toBeDefined();
			expect( error ).toBe( "Player not in game!" );
		} );

		it.sequential( "should do nothing when alarm is triggered and actual player has to make a move", async () => {
			await engine.alarm();
			const deal = engine.getCurrentDeal();
			expect( deal.declarations[ player1.id ] ).toBe( 0 );
		} );

		it.sequential( "should return error when player tries to declare out of turn", async () => {
			const deal = engine.getCurrentDeal();
			await engine.declareDealWins( { dealId: deal.id, wins: 5 }, player1 );

			const { error } = await engine.declareDealWins( { dealId: deal.id, wins: 2 }, player1 );
			expect( error ).toBeDefined();
			expect( error ).toBe( "Not your turn!" );
		} );

		it.sequential( "should declare wins for bots when alarm triggered", async () => {
			const deal = engine.getCurrentDeal();

			await engine.declareDealWins( { dealId: deal.id, wins: 5 }, player1 );
			await engine.alarm();
			await engine.alarm();
			await engine.alarm();

			for ( const playerId in deal.declarations ) {
				if ( playerId !== player1.id ) {
					expect( deal.declarations[ playerId ] ).toBeGreaterThanOrEqual( 2 );
				} else {
					expect( deal.declarations[ playerId ] ).toBe( 5 );
				}
			}
		} );

		it.sequential( "should return error when player tries to play card before round created", async () => {
			const deal = engine.getCurrentDeal();
			const { error } = await engine.playCard( { dealId: deal.id, roundId: "round-1", cardId: "AH" }, player1 );

			expect( error ).toBeDefined();
			expect( error ).toBe( "Round not found!" );
		} );

		it.sequential( "should create a new round after all players have declared wins", async () => {
			await engine.alarm();
			const round = engine.getCurrentRound();
			expect( round ).toBeDefined();
			expect( engine.getStatus() ).toBe( "ROUND_STARTED" );
		} );

		it.sequential( "should return error when non-existent player tries to play a card", async () => {
			const deal = engine.getCurrentDeal();
			const round = engine.getCurrentRound();
			const { error } = await engine.playCard( { dealId: deal.id, roundId: round.id, cardId: "AH" }, player2 );

			expect( error ).toBeDefined();
			expect( error ).toBe( "Player not in game!" );
		} );

		it.sequential( "should do nothing when alarm is triggered and actual player has to make a move", async () => {
			await engine.alarm();
			const round = engine.getCurrentRound();
			expect( round.cards[ player1.id ] ).toBeUndefined();
		} );

		it.sequential( "should return error when player tries to play a card not in hand", async () => {
			const deal = engine.getCurrentDeal();
			const round = engine.getCurrentRound();
			const { error } = await engine.playCard( { dealId: deal.id, roundId: round.id, cardId: "2H" }, player1 );

			expect( error ).toBeDefined();
			expect( error ).toBe( "Card not in hand!" );
		} );

		it.sequential( "should return error when player tries to play out of turn", async () => {
			const deal = engine.getCurrentDeal();
			const round = engine.getCurrentRound();

			await engine.playCard( { dealId: deal.id, roundId: round.id, cardId: "6H" }, player1 );
			const { error } = await engine.playCard( { dealId: deal.id, roundId: round.id, cardId: "AH" }, player1 );

			expect( error ).toBeDefined();
			expect( error ).toBe( "Not your turn!" );
		} );

		it.sequential( "should play cards for bots when alarm is triggered", async () => {
			const round = engine.getCurrentRound();

			await engine.alarm();
			await engine.alarm();
			await engine.alarm();

			expect( Object.keys( round.cards ).length ).toBe( 4 );

			for ( const playerId in round.cards ) {
				if ( playerId !== player1.id ) {
					expect( round.cards[ playerId ] ).toBeDefined();
				} else {
					expect( round.cards[ playerId ] ).toBe( "6H" );
				}
			}
		} );

		it.sequential( "should complete round and start new round on alarm trigger", async () => {
			await engine.alarm();
			const round = engine.getCurrentRound();

			expect( round ).toBeDefined();
			expect( round.status ).toBe( "COMPLETED" );
			expect( engine.getStatus() ).toBe( "ROUND_COMPLETED" );

			await engine.alarm();
			const newRound = engine.getCurrentRound();
			expect( newRound ).toBeDefined();
			expect( engine.getStatus() ).toBe( "ROUND_STARTED" );
		} );

		it.sequential( "should simulate remaining rounds and complete the deal", async () => {
			const deal = engine.getCurrentDeal();
			const { data } = await engine.getPlayerData( player1.id );

			let playedRounds = 1;
			while ( playedRounds < 13 ) {
				const round = engine.getCurrentRound();
				for ( let i = 0; i < round.playerOrder.length; i++ ) {
					const playerId = round.playerOrder[ i ];
					if ( engine.isBot( playerId ) ) {
						await engine.alarm();
					} else {
						const cards = deal.rounds.flatMap( round => Object.values( round.cards ) );
						const suggestion = suggestCardToPlay( deal.hands[ playerId ], data!.trump, cards, round );
						const input: PlayCardInput = {
							dealId: deal.id,
							roundId: round.id,
							cardId: suggestion
						};

						await engine.playCard( input, players[ playerId ] );
					}
				}

				await engine.alarm();
				expect( engine.getStatus() ).toBe( "ROUND_COMPLETED" );

				await engine.alarm();
				if ( playedRounds < 12 ) {
					expect( engine.getStatus() ).toBe( "ROUND_STARTED" );
				} else {
					expect( engine.getStatus() ).toBe( "DEAL_COMPLETED" );
				}

				playedRounds++;
			}

		} );

		it.sequential( "should create a new deal after alarm if deals are remaining", async () => {
			await engine.alarm();
			const currentDeal = engine.getCurrentDeal();
			expect( currentDeal ).toBeDefined();
			expect( engine.getStatus() ).toBe( "CARDS_DEALT" );
		} );
	} );

	describe( "GamePlay: Happy Path", () => {
		let engine: MockCallbreakEngine;

		it.sequential( "should load existing game data", async () => {
			const existingGameData: GameData = {
				id: "game-1",
				code: "ABC123",
				trump: "C",
				dealCount: 9,
				status: "GAME_CREATED",
				players: {},
				scores: {},
				deals: [],
				currentTurn: "",
				createdBy: ""
			};

			vi.mocked( mockEnv.CALLBREAK_KV.get ).mockResolvedValueOnce( existingGameData as any );
			engine = new MockCallbreakEngine( mockDurableObjectState, mockEnv );

			expect( mockEnv.CALLBREAK_KV.get ).toHaveBeenCalledWith( "mock-do-id", "json" );
		} );

		it.sequential( "should initialize the game with provided settings", async () => {
			await engine.initialize( { dealCount: 5, trumpSuit: "H" }, player1.id );
			await engine.addPlayer( player1 );
			const { data } = await engine.getPlayerData( player1.id );

			expect( data ).toBeDefined();
			expect( data?.dealCount ).toBe( 5 );
			expect( data?.trump ).toBe( "H" );

			expect( mockEnv.CALLBREAK_KV.put ).toHaveBeenCalledWith(
				expect.stringContaining( "gameId:" ),
				"mock-do-id"
			);

			expect( mockEnv.CALLBREAK_KV.put ).toHaveBeenCalledWith( expect.stringContaining( "code:" ), "mock-do-id" );
			expect( mockEnv.CALLBREAK_KV.put ).toHaveBeenCalledWith( "mock-do-id", expect.any( String ) );
		} );

		it.sequential( "should add players when add players is called", async () => {
			await engine.addPlayer( player2 );
			await engine.addPlayer( player3 );
			await engine.addPlayer( player4 );

			const { data } = await engine.getPlayerData( player1.id );

			expect( Object.keys( data?.players || {} ).length ).toBe( 4 );
			expect( data?.status ).toBe( "PLAYERS_READY" );
		} );

		it.sequential( "should create a new deal and deal cards to players when alarm is triggered", async () => {
			engine.setDealCount( 1 );
			await engine.alarm();
			const { data } = await engine.getPlayerData( player1.id );

			expect( data ).toBeDefined();
			expect( data?.currentDeal ).toBeDefined();
			expect( data?.status ).toBe( "CARDS_DEALT" );
			expect( data?.hand?.length ).toBe( 13 );
		} );

		it.sequential( "should create hands and update the hands in deal", async () => {
			const hands: CardId[][] = [
				[ "AH", "10H", "7H", "6H", "AC", "QC", "10C", "5S", "3S", "QD", "10D", "6D", "2D" ],
				[ "KH", "9H", "8H", "JC", "8C", "6C", "JS", "10S", "7S", "4S", "2S", "9D", "3D" ],
				[ "JH", "5H", "KC", "9C", "7C", "AS", "KS", "AD", "KD", "JD", "8D", "7D", "5D" ],
				[ "QH", "4H", "3H", "2H", "5C", "4C", "3C", "2C", "QS", "9S", "8S", "6S", "4D" ]
			];

			engine.setHands( hands );
			const deal = engine.getCurrentDeal();

			deal.playerOrder.forEach( ( playerId, idx ) => {
				expect( deal.hands[ playerId ] ).toEqual( hands[ idx ] );
			} );
		} );

		it.sequential( "should declare deal wins for all the players", async () => {
			const deal = engine.getCurrentDeal();
			const trump = engine.getTrump();

			let suggestion = suggestDealWins( deal.hands[ player1.id ], trump );
			expect( suggestion ).toBe( 5 );
			await engine.declareDealWins( { dealId: deal.id, wins: 5 }, player1 );

			suggestion = suggestDealWins( deal.hands[ player2.id ], trump );
			expect( suggestion ).toBe( 2 );
			await engine.declareDealWins( { dealId: deal.id, wins: 2 }, player2 );

			suggestion = suggestDealWins( deal.hands[ player3.id ], trump );
			expect( suggestion ).toBe( 5 );
			await engine.declareDealWins( { dealId: deal.id, wins: 5 }, player3 );

			suggestion = suggestDealWins( deal.hands[ player4.id ], trump );
			expect( suggestion ).toBe( 4 );
			await engine.declareDealWins( { dealId: deal.id, wins: 4 }, player4 );

			expect( engine.getStatus() ).toBe( "WINS_DECLARED" );
		} );

		it.sequential( "should create a new round after all players have declared wins", async () => {
			await engine.alarm();
			const round = engine.getCurrentRound();
			expect( round ).toBeDefined();
			expect( engine.getStatus() ).toBe( "ROUND_STARTED" );
		} );

		it.sequential( "should return error when player tries to play an invalid card", async () => {
			const deal = engine.getCurrentDeal();
			const round = engine.getCurrentRound();

			await engine.playCard( { dealId: deal.id, roundId: round.id, cardId: "10D" }, player1 );
			await engine.playCard( { dealId: deal.id, roundId: round.id, cardId: "3D" }, player2 );

			const invalidInput: PlayCardInput = { dealId: deal.id, roundId: round.id, cardId: "8D" };
			const { error } = await engine.playCard( invalidInput, player3 );

			expect( error ).toBeDefined();
			expect( error ).toBe( "Card cannot be played!" );

			await engine.playCard( { dealId: deal.id, roundId: round.id, cardId: "KD" }, player3 );
			await engine.playCard( { dealId: deal.id, roundId: round.id, cardId: "4D" }, player4 );

			await engine.alarm();
			await engine.alarm();
		} );

		it.sequential( "should simulate all the rounds and complete the deal", async () => {
			const deal = engine.getCurrentDeal();
			const winners = [ "p3", "p3", "p3", "p1", "p1", "p3", "p4", "p1", "p4", "p3", "p2", "p2", "p1" ];
			const cardPlays: Record<string, CardId[]> = {
				p1: [ "10D", "3S", "5S", "QC", "AC", "10C", "2D", "AH", "6D", "6H", "QD", "7H", "10H" ],
				p2: [ "3D", "2S", "4S", "6C", "8C", "JC", "9D", "7S", "8H", "10S", "9H", "KH", "JS" ],
				p3: [ "KD", "KS", "AS", "9C", "7C", "KC", "AD", "5D", "7D", "JH", "8D", "5H", "JD" ],
				p4: [ "4D", "6S", "8S", "2C", "3C", "4C", "2H", "5C", "QH", "QS", "3H", "4H", "9S" ]
			};

			let playedRounds = 1;
			while ( playedRounds < winners.length ) {
				const round = engine.getCurrentRound();
				for ( let i = 0; i < round.playerOrder.length; i++ ) {
					const playerId = round.playerOrder[ i ];
					const input: PlayCardInput = {
						dealId: deal.id,
						roundId: round.id,
						cardId: cardPlays[ playerId ][ playedRounds ]
					};

					const { error } = await engine.playCard( input, players[ playerId ] );
					expect( error ).toBeUndefined();
					expect( round.cards[ playerId ] ).toBe( cardPlays[ playerId ][ playedRounds ] );
				}

				expect( engine.getStatus() ).toBe( "CARDS_PLAYED" );

				await engine.alarm();
				expect( round.status ).toBe( "COMPLETED" );
				expect( round.winner ).toBe( winners[ playedRounds ] );

				playedRounds++;

				await engine.alarm();
				if ( playedRounds < winners.length - 1 ) {
					expect( engine.getStatus() ).toBe( "ROUND_STARTED" );
				}
			}

			expect( engine.getStatus() ).toBe( "DEAL_COMPLETED" );
			Object.keys( players ).forEach( playerId => {
				expect( deal.wins[ playerId ] ).toBe( winners.filter( winnerId => winnerId === playerId ).length );
			} );
		} );

		it.sequential( "should complete the game after all deals are played", async () => {
			await engine.alarm();
			expect( engine.getStatus() ).toBe( "GAME_COMPLETED" );

			const scores = {
				p1: [ -50 ],
				p2: [ 20 ],
				p3: [ 50 ],
				p4: [ -40 ]
			};

			const { data } = await engine.getPlayerData( player1.id );
			expect( data?.scores ).toEqual( scores );
		} );

	} );

} );