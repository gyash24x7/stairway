import { botDeclare, botPlayCard } from "@/callbreak/core/bot";
import type {
	CallbreakConfig,
	CallbreakData,
	CallbreakPlayerView,
	DeclareWinsInput,
	PlayCardInput
} from "@/callbreak/core/types";
import {
	calculateRoundScore,
	createNewDeal,
	determineTrickWinner,
	emptyTrick,
	getPlayableCards,
	PLAYER_COUNT,
	TRICKS_PER_DEAL
} from "@/callbreak/core/utils";
import { GameEngine } from "@/shared/engine/engine";
import { getCardSuit } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "Callbreak:Engine" );

export const callbreakEngine = new GameEngine( {
	name: "callbreak",

	playerView: ( data, _config, playerId ): CallbreakPlayerView => {
		const activeDeal = data.deals[ 0 ];
		if ( activeDeal ) {
			const { hands, ...deal } = activeDeal;
			return { activeDeal: deal, scores: data.scores, hand: hands[ playerId ], playerId };
		}

		return { scores: data.scores, hand: [], playerId };
	},

	setup: ( _config: CallbreakConfig ): CallbreakData => ( { deals: [], scores: {} } ),

	onJoin: ( state, _config, playerId ) => {
		state.data.scores[ playerId ] = 0;
		return state.data;
	},

	onStart: ( state, _config ) => {
		state.data.deals.unshift( createNewDeal( state.ctx.players ) );
		return state.data;
	},

	moves: {
		declareWins: {
			validate: ( state, _config, playerId, input: DeclareWinsInput ) => {
				logger.debug( ">> validateDeclareWins()" );

				const activeDeal = state.data.deals[ 0 ];
				if ( !activeDeal || activeDeal.id !== input.dealId ) {
					throw new Error( "Active Deal Not Found!" );
				}

				if ( activeDeal.phase !== "calling" ) {
					throw new Error( "Invalid phase!" );
				}

				if ( activeDeal.declarations[ playerId ] > 0 ) {
					throw new Error( "Already declared wins!" );
				}

				logger.debug( "<< validateDeclareWins()" );
			},
			execute: ( state, _config, playerId, input: DeclareWinsInput ) => {
				logger.debug( ">> declareWins()" );

				const activeDeal = state.data.deals[ 0 ];

				activeDeal.declarations[ playerId ] = input.wins;

				const allDeclared = state.ctx.players.every( pid => activeDeal.declarations[ pid ] > 0 );

				if ( allDeclared ) {
					activeDeal.phase = "playing";
					activeDeal.tricks.unshift( emptyTrick( activeDeal.startingPlayer ) );
				}

				logger.debug( "<< declareWins()" );
				return state.data;
			}
		},

		playCard: {
			validate: ( state, config, playerId, input: PlayCardInput ) => {
				logger.debug( ">> validatePlayCard()" );

				const activeDeal = state.data.deals[ 0 ];
				if ( !activeDeal || activeDeal.id !== input.dealId ) {
					throw new Error( "Active Deal Not Found!" );
				}

				if ( activeDeal.phase !== "playing" ) {
					throw new Error( "Invalid phase!" );
				}

				const activeTrick = activeDeal.tricks[ 0 ];
				if ( !activeTrick ) {
					throw new Error( "Active Trick Not Found!" );
				}

				if ( !!activeTrick.cards[ playerId ] ) {
					throw new Error( "Already played card!" );
				}

				const hand = activeDeal.hands[ playerId ];
				if ( !hand.includes( input.cardId ) ) {
					throw new Error( "Card not in hand!" );
				}

				const playableCards = getPlayableCards( hand, config.trumpSuit, activeTrick );
				if ( !playableCards.includes( input.cardId ) ) {
					throw new Error( "Card cannot be played!" );
				}

				logger.debug( "<< validatePlayCard()" );
			},
			execute: ( state, config, playerId, input: PlayCardInput ) => {
				logger.debug( ">> playCard()" );

				const activeDeal = state.data.deals[ 0 ];
				const activeTrick = activeDeal.tricks[ 0 ];

				activeDeal.hands[ playerId ] = activeDeal.hands[ playerId ].filter( c => c !== input.cardId );
				activeTrick.cards[ playerId ] = input.cardId;

				if ( !activeTrick.suit ) {
					activeTrick.suit = getCardSuit( input.cardId );
				}

				const trickCardCount = Object.keys( activeTrick.cards ).length;

				if ( trickCardCount >= PLAYER_COUNT ) {
					const winner = determineTrickWinner( activeTrick, config.trumpSuit, state.ctx.players );
					activeTrick.winner = winner;
					activeDeal.wins[ winner ]++;
				}

				logger.debug( "<< playCard()" );
				return state.data;
			}
		}
	},

	afterMove: ( state, config ) => {
		const activeDeal = state.data.deals[ 0 ];
		if ( !activeDeal ) {
			return undefined;
		}

		const activeTrick = activeDeal.tricks[ 0 ];
		if ( !activeTrick?.winner ) {
			return undefined;
		}

		const completedTricks = activeDeal.tricks.filter( t => !!t.winner ).length;

		if ( completedTricks >= TRICKS_PER_DEAL ) {
			for ( const pid of state.ctx.players ) {
				const score = calculateRoundScore( activeDeal.declarations[ pid ], activeDeal.wins[ pid ] );
				activeDeal.scores[ pid ] = score;
				state.data.scores[ pid ] = ( state.data.scores[ pid ] ?? 0 ) + score;
			}

			const completedDeals = state.data.deals.filter( d =>
				Object.values( d.scores ).some( s => s !== 0 )
			).length;

			if ( completedDeals < config.dealCount ) {
				const startIdx = state.ctx.players.indexOf( activeDeal.startingPlayer );
				const nextStarter = state.ctx.players[ ( startIdx + 1 ) % state.ctx.players.length ];
				state.data.deals.unshift( createNewDeal( state.ctx.players, nextStarter ) );
			}
		} else {
			activeDeal.tricks.unshift( emptyTrick( activeTrick.winner ) );
		}

		return state.data;
	},

	botMove: ( state, config ) => {
		if ( state.data.activeDeal?.phase === "calling" ) {
			const wins = botDeclare( state, config );
			return { moveType: "declareWins", input: { matchId: "", wins, dealId: state.data.activeDeal.id } };
		}

		const cardId = botPlayCard( state, config );
		return { moveType: "playCard", input: { matchId: "", cardId, dealId: state.data.activeDeal!.id } };
	},

	getNextPlayer: ( state ) => {
		const { data, ctx } = state;
		const activeDeal = data.deals[ 0 ];
		if ( !activeDeal ) {
			return ctx.players[ 0 ];
		}

		if ( activeDeal.phase === "calling" ) {
			const startIdx = ctx.players.indexOf( activeDeal.startingPlayer );
			for ( let i = 0; i < ctx.players.length; i++ ) {
				const pid = ctx.players[ ( startIdx + i ) % ctx.players.length ];
				if ( activeDeal.declarations[ pid ] === 0 ) {
					return pid;
				}
			}
			return activeDeal.startingPlayer;
		}

		const activeTrick = activeDeal.tricks[ 0 ];
		if ( !activeTrick ) {
			return ctx.players[ 0 ];
		}

		if ( activeTrick.winner ) {
			return activeTrick.winner;
		}

		const cardsPlayed = Object.keys( activeTrick.cards ).length;
		if ( cardsPlayed === 0 ) {
			return activeTrick.leadPlayer;
		}

		const lastPlayer = Object.keys( activeTrick.cards ).pop()!;
		const lastIdx = ctx.players.indexOf( lastPlayer );
		return ctx.players[ ( lastIdx + 1 ) % PLAYER_COUNT ];
	},

	endIf: ( state, config ) => {
		const completedDeals = state.data.deals.filter( d =>
			Object.values( d.scores ).some( s => s !== 0 )
		).length;

		if ( completedDeals < config.dealCount ) {
			return undefined;
		}

		const players = state.ctx.players;
		const winner = players.reduce( ( best, pid ) =>
			( state.data.scores[ pid ] ?? 0 ) > ( state.data.scores[ best ] ?? 0 ) ? pid : best
		);

		return { victory: true, winner };
	}
} );
