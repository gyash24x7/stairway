import type { PrismaClient, User } from "@prisma/client";
import { LitGameStatus, LitMove, LitMoveType, LitPlayer, LitTeam } from "@prisma/client";
import { CardDeck, CardHand, CardRank, CardSet, cardSetMap, ICardHand, PlayingCard } from "@s2h/cards";
import type { IEnhancedLitGame } from "@s2h/literature/utils";
import type { Publisher } from "@s2h/utils";
import { createId as cuid } from "@paralleldrive/cuid2";
import { chunk } from "lodash";
import { LoremIpsum } from "lorem-ipsum";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";
import type { LitGameData } from "../../src/types";

export type LitMockContext = {
	loggedInUser?: User;
	prisma: DeepMockProxy<PrismaClient>;
	litGamePublisher: DeepMockProxy<Publisher<IEnhancedLitGame>>
}

export function createMockContext( loggedInUser?: User ): LitMockContext {
	return { prisma: mockDeep(), litGamePublisher: mockDeep(), loggedInUser };
}

export function createMockUser( id: string = cuid(), name: string = "Mock User" ): User {
	return { id, name, avatar: "", salt: "", email: "" };
}

const lorem = new LoremIpsum();

type MockLitGameDataParams = { code?: string, status?: LitGameStatus, playerCount?: number, createdById?: string };
type MockLitPlayerParams = { name?: string, userId?: string, teamId?: string, addToList?: boolean }
type MockLitTeamParams = { names?: string[], addToList?: boolean };
type MockLitAskMoveParams = { askedFrom: LitPlayer, askedBy: LitPlayer, askedFor: PlayingCard };
type MockLitGiveMoveParams = { givingPlayer: LitPlayer, takingPlayer: LitPlayer, card: PlayingCard };
type MockLitTurnMoveParams = { turnPlayer: LitPlayer };
type MockLitDeclinedMoveParams = { askingPlayer: LitPlayer, declinedPlayer: LitPlayer, card: PlayingCard };
type MockLitCallMoveParams = { turnPlayer: LitPlayer, cardSet: CardSet, callingPlayer: LitPlayer };

type MockLitMoveParams =
	MockLitGiveMoveParams
	| MockLitAskMoveParams
	| MockLitTurnMoveParams
	| MockLitDeclinedMoveParams
	| MockLitCallMoveParams;

export class MockLitGameData implements LitGameData {
	readonly id: string;
	readonly code: string;
	status: LitGameStatus;
	playerCount: number;
	readonly createdById: string;

	moves: LitMove[] = [];
	players: LitPlayer[] = [];
	teams: LitTeam[] = [];

	readonly createdAt: Date;
	readonly updatedAt: Date;

	private playerData: Record<string, LitPlayer> = {};
	private teamData: Record<string, LitTeam> = {};

	private readonly baseLitMove: LitMove;

	constructor( { code, createdById, playerCount, status }: MockLitGameDataParams = {} ) {
		this.code = code || "ABC123";
		this.status = status || LitGameStatus.IN_PROGRESS;
		this.playerCount = playerCount || 2;
		this.id = cuid();
		this.createdById = createdById || cuid();

		this.createdAt = new Date();
		this.updatedAt = new Date();

		this.baseLitMove = {
			id: cuid(),
			type: LitMoveType.TURN,
			description: "",
			askedFor: null,
			turnId: null,
			askedFromId: null,
			askedById: null,
			gameId: this.id,
			createdAt: new Date
		};
	}

	dealCards( sort = true ) {
		const deck = new CardDeck();
		if ( sort ) {
			deck.sort();
		}

		deck.removeCardsOfRank( CardRank.SEVEN );

		const hands = deck.generateHands( this.playerCount );
		this.players.map( ( player, i ) => {
			this.playerData[ player.id ].hand = hands[ i ].serialize();
		} );

		this.players = Object.values( this.playerData );
		return this.players;
	}

	dealCardsForSuccessfulCall( cardSet: CardSet = CardSet.SMALL_HEARTS ) {
		const deck = new CardDeck();
		deck.removeCardsOfRank( CardRank.SEVEN );
		const cardsOfSet = cardSetMap[ cardSet ];
		const hands = deck.generateHands( this.playerCount );

		hands.forEach( ( _, i ) => {
			hands[ i ].removeCardsOfSet( cardSet );
			if ( i < 3 ) {
				hands[ i ].addCard( cardsOfSet[ i * 2 ], cardsOfSet[ i * 2 + 1 ] );
			}
		} );

		this.players.map( ( player, i ) => {
			this.playerData[ player.id ].hand = hands[ i ].serialize();
		} );

		this.players = Object.values( this.playerData );
		return this.players;
	}

	generatePlayer( { name, userId, teamId, addToList }: MockLitPlayerParams = {} ) {
		const player: LitPlayer = {
			id: cuid(),
			name: name || lorem.generateWords( 2 ),
			userId: userId || cuid(),
			teamId: teamId || cuid(),
			hand: { cards: [] },
			gameId: this.id,
			avatar: ""
		};

		if ( addToList !== false ) {
			this.players.push( player );
			this.playerData[ player.id ] = player;
		}

		return player;
	}

	generateTeams( { names, addToList }: MockLitTeamParams = {} ) {
		if ( !names ) {
			names = [ lorem.generateWords( 1 ), lorem.generateWords( 1 ) ];
		}

		const teams: LitTeam[] = names.map( name => (
			{ name, id: cuid(), score: 0, gameId: this.id }
		) );

		if ( addToList !== false ) {
			this.teams = teams;
			teams.forEach( team => this.teamData[ team.id ] = team );

			const playerGroups = chunk( this.players, this.playerCount / 2 );
			playerGroups.forEach( ( teamMembers, i ) => {
				teamMembers.forEach( member => {
					this.playerData[ member.id ].teamId = this.teams[ i ].id;
				} );
			} );

			this.players = Object.values( this.playerData );
		}

		return teams;
	}

	setHand( playerId: string, hand: CardHand ) {
		this.playerData[ playerId ].hand = hand.serialize();
		this.players = Object.values( this.playerData );
	}

	removeCardsOfSetFromHand( playerId: string, cardSet: CardSet = CardSet.SMALL_HEARTS ) {
		const hand = CardHand.from( this.playerData[ playerId ].hand as unknown as ICardHand );
		hand.removeCardsOfSet( cardSet );
		return hand.serialize();
	}

	generateMove( type: LitMoveType, data: MockLitMoveParams, addToList = true ) {
		let move: LitMove | undefined;
		switch ( type ) {
			case LitMoveType.ASK: {
				const { askedFrom, askedBy, askedFor } = data as MockLitAskMoveParams;
				move = {
					...this.baseLitMove,
					type: LitMoveType.ASK,
					description: `${ askedBy.name } asked for ${ askedFor.cardString } from ${ askedFrom.name }`,
					askedFor: askedFor.serialize(),
					askedFromId: askedFrom.id,
					askedById: askedBy.id
				};
				break;
			}

			case LitMoveType.GIVEN: {
				const { givingPlayer, takingPlayer, card } = data as MockLitGiveMoveParams;
				move = {
					...this.baseLitMove,
					type: LitMoveType.GIVEN,
					turnId: takingPlayer.id,
					description: `${ givingPlayer.name } gave ${ card.cardString } to ${ takingPlayer.name }`
				};
				break;
			}

			case LitMoveType.TURN: {
				const { turnPlayer } = data as MockLitTurnMoveParams;
				move = {
					...this.baseLitMove,
					type: LitMoveType.TURN,
					turnId: turnPlayer.id,
					description: `Waiting for ${ turnPlayer.name } to Ask or Call`
				};
				break;
			}

			case LitMoveType.DECLINED: {
				const { askingPlayer, declinedPlayer, card } = data as MockLitDeclinedMoveParams;
				move = {
					...this.baseLitMove,
					type: LitMoveType.DECLINED,
					turnId: declinedPlayer.id,
					description: `${ declinedPlayer.name } declined ${ askingPlayer.name }'s ask for ${ card.cardString }`
				};
				break;
			}

			case LitMoveType.CALL_SUCCESS: {
				const { turnPlayer, cardSet } = data as MockLitCallMoveParams;
				move = {
					...this.baseLitMove,
					type: LitMoveType.CALL_SUCCESS,
					turnId: turnPlayer.id,
					description: `${ turnPlayer.name } called ${ cardSet } correctly`
				};
				break;
			}

			case LitMoveType.CALL_FAIL: {
				const { turnPlayer, cardSet, callingPlayer } = data as MockLitCallMoveParams;
				move = {
					...this.baseLitMove,
					type: LitMoveType.CALL_FAIL,
					turnId: turnPlayer.id,
					description: `${ callingPlayer.name } called ${ cardSet } incorrectly. ${ turnPlayer.name }'s turn`
				};
				break;
			}
		}

		if ( addToList && !!move ) {
			this.moves.push( move );
		}

		return move!;
	}
}