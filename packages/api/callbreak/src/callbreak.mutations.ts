import type { UserAuthInfo } from "@auth/api";
import { namesConfig } from "@literature/api/src/literature.constants.ts";
import { Injectable } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { CardDeck, CardHand, CardSuit, generateGameCode, getBestCardPlayed, PlayingCard } from "@stairway/cards";
import { format } from "node:util";
import { uniqueNamesGenerator } from "unique-names-generator";
import { CallBreakBotService } from "./callbreak.bot.service.ts";
import { GameEvents } from "./callbreak.constants.ts";
import { CallBreakGateway } from "./callbreak.gateway.ts";
import type { CreateGameInput, DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "./callbreak.inputs.ts";
import { CallBreakPrisma } from "./callbreak.prisma.ts";
import type { Deal, DealWithRounds, Game, PlayerData } from "./callbreak.types.ts";
import { CallBreakValidators } from "./callbreak.validators.ts";

@Injectable()
export class CallBreakMutations {

	constructor(
		private readonly prisma: CallBreakPrisma,
		private readonly validators: CallBreakValidators,
		private readonly gateway: CallBreakGateway,
		private readonly botService: CallBreakBotService,
		@OgmaLogger( CallBreakMutations ) private readonly logger: OgmaService
	) {}

	async createGame( { dealCount, trumpSuit }: CreateGameInput, { id, name, avatar }: UserAuthInfo ) {
		this.logger.debug( ">> createGame()" );

		const code = generateGameCode();
		const game = await this.prisma.game.create( { data: { code, dealCount, trumpSuit, createdBy: id } } );
		await this.prisma.player.create( { data: { gameId: game.id, id, name, avatar } } );

		this.logger.debug( "<< createGame()" );
		return game;
	}

	async joinGame( input: JoinGameInput, authInfo: UserAuthInfo ) {
		this.logger.debug( ">> joinGame()" );

		const { game, alreadyJoined } = await this.validators.validateJoinGame( input, authInfo );
		if ( alreadyJoined ) {
			this.logger.warn( format( "Player Already Joined: %s", authInfo.id ) );
			return game;
		}

		const player = await this.prisma.player.create( {
			data: { gameId: game.id, id: authInfo.id, name: authInfo.name, avatar: authInfo.avatar }
		} );

		this.gateway.publishGameEvent( game.id, GameEvents.PLAYER_JOINED, player );

		game.players.push( player );

		if ( game.players.length === 4 ) {
			this.logger.info( "All Players joined, Starting the game..." );

			const updatedGame = await this.prisma.game.update( {
				where: { id: game.id },
				data: { status: "IN_PROGRESS" }
			} );

			this.gateway.publishGameEvent( game.id, GameEvents.ALL_PLAYERS_JOINED, updatedGame );
		}

		this.logger.debug( "<< joinGame()" );
		return game;
	}

	async addBots( game: Game, players: PlayerData ) {
		this.logger.debug( ">> addBots()" );

		const botCount = await this.validators.validateAddBots( game, players );
		for ( let i = 0; i < botCount; i++ ) {
			const name = uniqueNamesGenerator( namesConfig );
			const hash = Bun.hash( name );
			const avatar = `https://api.dicebear.com/7.x/open-peeps/png?seed=${ hash }&r=50`;
			const bot = await this.prisma.player.create( { data: { name, avatar, gameId: game.id, isBot: true } } );

			this.gateway.publishGameEvent( game.id, GameEvents.PLAYER_JOINED, bot );
			players[ bot.id ] = bot;
		}

		const updatedGame = await this.prisma.game.update( {
			where: { id: game.id },
			data: { status: "IN_PROGRESS" }
		} );

		this.gateway.publishGameEvent( game.id, GameEvents.ALL_PLAYERS_JOINED, updatedGame );

		setTimeout( async () => {
			this.logger.debug( "Creating new deal..." );
			await this.createDeal( updatedGame, players );
		}, 5000 );

		this.logger.debug( "<< addBots()" );
	}

	async createDeal( game: Game, players: PlayerData, lastDeal?: Deal ) {
		this.logger.debug( ">> createDeal()" );

		const deck = new CardDeck();
		const hands = deck.generateHandsFromCards( 4 );
		const playerIds = Object.keys( players ).toSorted();
		const playerOrder = !lastDeal ?
			[
				...playerIds.slice( playerIds.indexOf( game.createdBy ) ),
				...playerIds.slice( 0, playerIds.indexOf( game.createdBy ) )
			] :
			[ ...lastDeal.playerOrder.slice( 1 ), lastDeal.playerOrder[ 0 ] ];

		const deal = await this.prisma.deal.create( { data: { gameId: game.id, playerOrder } } );

		for ( const playerId of deal.playerOrder ) {
			const hand = hands.shift() ?? CardHand.empty();
			await this.prisma.cardMapping.createMany( {
				data: hand.cardIds.map( cardId => ( {
					cardId: cardId,
					dealId: deal.id,
					gameId: game.id,
					playerId
				} ) )
			} );

			this.gateway.publishPlayerEvent( game.id, playerId, GameEvents.CARDS_DEALT, hand.serialize() );
		}

		this.gateway.publishGameEvent( game.id, GameEvents.DEAL_CREATED, deal );

		this.logger.debug( "<< createDeal()" );
		return deal;
	}

	async declareDealWins( input: DeclareDealWinsInput, game: Game, players: PlayerData, playerId: string ) {
		this.logger.debug( ">> declareDealWins()" );

		let deal = await this.validators.validateDealWinDeclaration( input, game, playerId );

		deal = await this.prisma.deal.update( {
			where: { id_gameId: { id: input.dealId, gameId: game.id } },
			data: {
				declarations: { ...deal.declarations, [ playerId ]: input.wins },
				turnIdx: { increment: 1 }
			},
			include: { rounds: true }
		} );

		this.gateway.publishGameEvent(
			game.id,
			GameEvents.DEAL_WIN_DECLARED,
			{ deal, by: players[ playerId ], wins: input.wins }
		);

		const nextPlayer = deal.playerOrder[ deal.turnIdx ];
		if ( players[ nextPlayer ]?.isBot ) {
			setTimeout( async () => {
				const mappings = await this.prisma.cardMapping.findMany( {
					where: { gameId: game.id, dealId: deal.id, playerId: nextPlayer }
				} );

				const hand = CardHand.fromMappings( mappings );
				const wins = this.botService.suggestDealWins( hand, game.trumpSuit as CardSuit );

				await this.declareDealWins( { gameId: game.id, dealId: deal.id, wins }, game, players, nextPlayer );
			}, 5000 );
		}

		if ( deal.turnIdx === 4 ) {
			this.logger.info( "All players declared wins, Starting the round..." );

			deal = await this.prisma.deal.update( {
				where: { id_gameId: { id: input.dealId, gameId: game.id } },
				data: { status: "IN_PROGRESS" },
				include: { rounds: true }
			} );

			this.gateway.publishGameEvent( game.id, GameEvents.ALL_DEAL_WINS_DECLARED, deal );

			setTimeout( async () => {
				await this.createRound( deal, game, players );
			}, 5000 );
		}

		this.logger.debug( "<< declareDealWins()" );
	}

	async createRound( deal: DealWithRounds, game: Game, players: PlayerData ) {
		this.logger.debug( ">> createRound()" );

		const lastRound = deal.rounds[ 0 ];
		const playerOrder = !lastRound ? deal.playerOrder : [
			...lastRound.playerOrder.slice( lastRound.playerOrder.indexOf( lastRound.winner! ) ),
			...lastRound.playerOrder.slice( 0, lastRound.playerOrder.indexOf( lastRound.winner! ) )
		];

		const round = await this.prisma.round.create( {
			data: { dealId: deal.id, gameId: game.id, playerOrder }
		} );

		deal.rounds.unshift( round );

		this.gateway.publishGameEvent( game.id, GameEvents.ROUND_CREATED, round );

		const firstPlayer = players[ playerOrder[ 0 ] ];
		if ( firstPlayer.isBot ) {
			setTimeout( async () => {
				const mappings = await this.prisma.cardMapping.findMany( {
					where: { gameId: game.id, dealId: deal.id, playerId: firstPlayer.id }
				} );

				const hand = CardHand.fromMappings( mappings );
				const card = this.botService.suggestCardToPlay( hand, deal, game.trumpSuit as CardSuit );
				const playCardInput = { gameId: game.id, dealId: deal.id, roundId: round.id, cardId: card.id };

				await this.playCard( playCardInput, game, players, firstPlayer.id );
			}, 5000 );
		}

		this.logger.debug( "<< createRound()" );
		return round;
	}

	async playCard( input: PlayCardInput, game: Game, players: PlayerData, playerId: string ) {
		this.logger.debug( ">> playCard()" );

		let { round } = await this.validators.validatePlayCard( input, game, playerId );

		round = await this.prisma.round.update( {
			where: { id_dealId_gameId: { id: round.id, gameId: game.id, dealId: input.dealId } },
			data: {
				suit: round.turnIdx === 0 ? PlayingCard.fromId( input.cardId ).suit : round.suit,
				cards: { ...round.cards, [ playerId ]: input.cardId },
				turnIdx: { increment: 1 }
			}
		} );

		await this.prisma.cardMapping.delete( {
			where: { cardId_dealId_gameId: { cardId: input.cardId, gameId: game.id, dealId: input.dealId } }
		} );

		this.gateway.publishGameEvent( game.id, GameEvents.CARD_PLAYED, { round, card: input.cardId, by: playerId } );

		let deal = await this.prisma.deal.findUniqueOrThrow( {
			where: { id_gameId: { id: input.dealId, gameId: game.id } },
			include: { rounds: { orderBy: { createdAt: "desc" } } }
		} );

		const nextPlayer = players[ round.playerOrder[ round.turnIdx ] ];
		if ( nextPlayer?.isBot ) {
			this.logger.debug( "Next player is bot executing turn after 5s..." );
			setTimeout( async () => {
				this.logger.debug( "Executing play card for bot..." );
				const mappings = await this.prisma.cardMapping.findMany( {
					where: { gameId: game.id, dealId: deal.id, playerId: nextPlayer.id }
				} );

				const hand = CardHand.fromMappings( mappings );
				const card = this.botService.suggestCardToPlay( hand, deal, game.trumpSuit as CardSuit );
				const playCardInput = { gameId: game.id, dealId: deal.id, roundId: round.id, cardId: card.id };

				await this.playCard( playCardInput, game, players, nextPlayer.id );
			}, 5000 );
		}

		if ( round.turnIdx === 4 ) {
			this.logger.info( "All players played their cards, Completing the round..." );

			const winningCard = getBestCardPlayed(
				Object.values( round.cards ).map( PlayingCard.fromId ),
				game.trumpSuit as CardSuit,
				round.suit as CardSuit
			);

			this.logger.info( format( "Winning Card: %s", winningCard ) );

			const winningPlayer = round.playerOrder.find( p => round.cards[ p ] === winningCard!.id );
			this.logger.info( format( "Player %s won the round", winningPlayer ) );

			round = await this.prisma.round.update( {
				where: { id_dealId_gameId: { id: round.id, gameId: game.id, dealId: input.dealId } },
				data: {
					completed: true,
					winner: winningPlayer
				}
			} );

			const wins: Record<string, number> = {};
			Object.keys( players ).forEach( p => {
				wins[ p ] = deal.rounds.filter( r => r.winner === p ).length;
				if ( winningPlayer === p ) {
					wins[ p ] = wins[ p ] + 1;
				}
			} );

			deal = await this.prisma.deal.update( {
				where: { id_gameId: { id: input.dealId, gameId: game.id } },
				data: { wins: { ...wins } },
				include: { rounds: { orderBy: { createdAt: "desc" } } }
			} );

			this.gateway.publishGameEvent(
				game.id,
				GameEvents.ROUND_COMPLETED,
				{ round, deal, winner: players[ winningPlayer! ] }
			);

			const completedRounds = deal.rounds.filter( r => r.completed ).length;

			if ( completedRounds === 13 ) {
				this.logger.info( "All rounds completed, Calculating scores for deal..." );

				deal = await this.prisma.deal.update( {
					where: { id_gameId: { id: input.dealId, gameId: game.id } },
					data: { status: "COMPLETED" },
					include: { rounds: { orderBy: { createdAt: "desc" } } }
				} );

				const score: Record<string, number> = {};
				Object.keys( players ).forEach( ( playerId ) => {
					const declared = deal.declarations[ playerId ];
					const won = wins[ playerId ];

					if ( declared > won ) {
						score[ playerId ] = ( -10 * declared );
					} else {
						score[ playerId ] = ( 10 * declared ) + ( 2 * ( won - declared ) );
					}
				} );

				this.gateway.publishGameEvent( game.id, GameEvents.DEAL_COMPLETED, { deal, score } );

				const completedDeals = await this.prisma.deal.count( {
					where: { gameId: game.id, status: "COMPLETED" }
				} );

				game = await this.prisma.game.update( {
					where: { id: game.id },
					data: {
						status: completedDeals === game.dealCount ? "COMPLETED" : "IN_PROGRESS",
						scores: [ score, ...game.scores ]
					}
				} );

				if ( completedDeals === game.dealCount ) {
					this.logger.info( "All deals completed, Game Over!" );
					this.gateway.publishGameEvent( game.id, GameEvents.GAME_COMPLETED, game );
				} else {
					this.logger.info( "Starting the next deal..." );
					setTimeout( async () => {
						await this.createDeal( game, players, deal );
					}, 5000 );
				}

			} else {
				this.logger.info( "Starting the next round..." );
				setTimeout( async () => {
					await this.createRound( deal, game, players );
				}, 5000 );
			}
		}

		this.logger.debug( "<< playCard()" );
		return round;
	}
}