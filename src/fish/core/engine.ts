import { detectTeammateSignals, suggestAsks, suggestBooks, suggestClaims, suggestTransfers } from "@/fish/core/bot";
import type {
	AskCardInput,
	Book,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishData,
	FishPlayerView,
	Metrics,
	TransferTurnInput
} from "@/fish/core/types";
import { getBookForCard, getCardsOfBook, getOpponents, getTeammates } from "@/fish/core/utils";
import { GameEngine } from "@/shared/engine/engine";
import type { PlayerId } from "@/shared/engine/types";
import { remove } from "@/shared/utils/array";
import { CARD_RANKS, type CardId, generateDeck, generateHands, getCardRank } from "@/shared/utils/cards";
import { generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";

const DEFAULT_METRICS: Metrics = {
	totalAsks: 0,
	cardsGiven: 0,
	cardsTaken: 0,
	totalClaims: 0,
	successfulClaims: 0
};

const logger = createLogger( "Fish:Engine" );

function getClaimedBooks( data: FishData ): Book[] {
	return Object.values( data.teams ).flatMap( s => s.booksWon );
}

export const fishEngine = new GameEngine( {
	name: "fish",

	getNextPlayer: ( state ) => {
		const { data, ctx } = state;

		let nextPlayer: PlayerId;

		switch ( data.lastMoveType ) {
			case "ask": {
				const lastAsk = data.askHistory[ 0 ];
				// Successful ask → same player keeps turn
				// Failed ask → turn goes to the asked opponent
				nextPlayer = lastAsk.success ? lastAsk.playerId : lastAsk.from;
				break;
			}

			case "claim": {
				const lastClaim = data.claimHistory[ 0 ];
				if ( lastClaim.success ) {
					// Successful claim → same player (can transfer or continue)
					nextPlayer = lastClaim.playerId;
					break;
				}
				// Failed claim → turn goes to an opponent with cards
				const opponents = getOpponents( data.teams, lastClaim.playerId );
				nextPlayer = opponents.find( pid => data.hands[ pid ]?.length > 0 ) ?? ctx.players[ 0 ];
				break;
			}

			case "transfer": {
				const lastTransfer = data.transferHistory[ 0 ];
				nextPlayer = lastTransfer.transferTo;
				break;
			}

			default:
				nextPlayer = ctx.currentPlayer;
		}

		// Auto-skip players with no cards — find a teammate with cards, then any player with cards
		if ( data.hands[ nextPlayer ]?.length === 0 ) {
			const teammates = getTeammates( data.teams, nextPlayer );
			const teammateWithCards = teammates.find( pid => data.hands[ pid ]?.length > 0 );
			if ( teammateWithCards ) {
				return teammateWithCards;
			}
			return ctx.players.find( pid => data.hands[ pid ]?.length > 0 ) ?? nextPlayer;
		}

		return nextPlayer;
	},

	playerView: ( data, _config, playerId ): FishPlayerView => {
		const { hands, ...rest } = data;
		return { ...rest, playerId, hand: hands[ playerId ] ?? [] };
	},

	setup: ( _config: FishConfig ): FishData => ( {
		playerData: {},
		teams: {},
		hands: {},
		cardCounts: {},
		cardLocations: {},
		askHistory: [],
		claimHistory: [],
		transferHistory: []
	} ),

	onJoin: ( state, _config, playerId ) => {
		state.data.playerData[ playerId ] = {
			teamId: "",
			metrics: { ...DEFAULT_METRICS }
		};
		return state.data;
	},

	onStart: ( state, config ) => {
		// Deal cards
		let deck = generateDeck();
		if ( config.deckType === 48 ) {
			deck = remove( ( card ) => getCardRank( card ) === CARD_RANKS.SEVEN, deck );
		}

		const hands = generateHands( deck, state.ctx.players.length );
		for ( let i = 0; i < state.ctx.players.length; i++ ) {
			state.data.hands[ state.ctx.players[ i ] ] = hands[ i ];
			state.data.cardCounts[ state.ctx.players[ i ] ] = hands[ i ].length;
		}

		state.data.cardLocations = deck.reduce(
			( acc, card ) => {
				acc[ card ] = state.ctx.players;
				return acc;
			},
			{} as Partial<Record<CardId, PlayerId[]>>
		);

		return state.data;
	},

	moves: {
		createTeams: {
			validate: ( state, config, _playerId, input: CreateTeamsInput ) => {
				logger.debug( ">> validateCreateTeams()" );

				if ( Object.keys( state.data.teams ).length > 0 ) {
					logger.error( "Teams have already been created!" );
					throw new Error( "Teams have already been created!" );
				}

				const teamCount = Object.keys( input.teams ).length;
				if ( teamCount !== config.teamCount ) {
					logger.error( "Team count does not match the game configuration!" );
					throw new Error( "Team count does not match the game configuration!" );
				}

				const playersSpecified = new Set( Object.values( input.teams ).flat() );
				if ( playersSpecified.size !== config.playerCount ) {
					logger.error( "Not all players are divided into teams!" );
					throw new Error( "Not all players are divided into teams!" );
				}

				const playersPerTeam = config.playerCount / teamCount;
				for ( const [ teamName, playerIds ] of Object.entries( input.teams ) ) {
					if ( playerIds.length !== playersPerTeam ) {
						logger.error( "Invalid number of players in team %s!", teamName );
						throw new Error( `Invalid number of players in team ${ teamName }!` );
					}

					for ( const playerId of playerIds ) {
						if ( !state.data.playerData[ playerId ] ) {
							logger.error( "Player %s is not part of the game!", playerId );
							throw new Error( `Player ${ playerId } is not part of the game!` );
						}
					}
				}

				logger.debug( "<< validateCreateTeams()" );
			},
			execute: ( state, _config, _playerId, input: CreateTeamsInput ) => {
				logger.debug( ">> createTeams()" );

				Object.entries( input.teams ).forEach( ( [ name, members ] ) => {
					const id = generateId();
					state.data.teams[ id ] = { id, name, members, score: 0, booksWon: [] };
					members.forEach( playerId => {
						state.data.playerData[ playerId ].teamId = id;
					} );
				} );

				logger.debug( "<< createTeams()" );
				return state.data;
			}
		},

		askCard: {
			validate: ( state, config, playerId, input: AskCardInput ) => {
				logger.debug( ">> validateAskCard()" );

				const hand = state.data.hands[ playerId ];
				if ( !hand || hand.length === 0 ) {
					throw new Error( "You have no cards! Transfer your turn instead." );
				}

				// Must ask an opponent
				const opponents = getOpponents( state.data.teams, playerId );
				if ( !opponents.includes( input.from ) ) {
					throw new Error( "You can only ask opponents for cards!" );
				}

				// Must hold at least one card from the same book
				const book = getBookForCard( input.cardId, config.type );
				const hasCardFromBook = hand.some( c => getBookForCard( c, config.type ) === book );
				if ( !hasCardFromBook ) {
					throw new Error( "You must hold at least one card from the same book!" );
				}

				// Cannot ask for a card you already have
				if ( hand.includes( input.cardId ) ) {
					throw new Error( "You already have this card!" );
				}

				// The book must not already be claimed
				if ( getClaimedBooks( state.data ).includes( book ) ) {
					throw new Error( "This book has already been claimed!" );
				}

				logger.debug( "<< validateAskCard()" );
			},
			execute: ( state, _config, playerId, input: AskCardInput ) => {
				logger.debug( ">> askCard()" );

				const opponentHand = state.data.hands[ input.from ];
				const hasCard = opponentHand.includes( input.cardId );

				if ( hasCard ) {
					// Transfer card from opponent to asking player
					state.data.hands[ input.from ] = opponentHand.filter( c => c !== input.cardId );
					state.data.cardCounts[ input.from ]--;
					state.data.playerData[ input.from ].metrics.cardsGiven++;

					state.data.hands[ playerId ].push( input.cardId );
					state.data.cardCounts[ playerId ]++;
					state.data.playerData[ playerId ].metrics.cardsTaken++;
				}

				state.data.playerData[ playerId ].metrics.totalAsks++;
				state.data.lastMoveType = "ask";

				state.data.askHistory.unshift( {
					success: hasCard,
					playerId,
					from: input.from,
					cardId: input.cardId,
					timestamp: Date.now()
				} );

				const possibleOwners = state.data.cardLocations[ input.cardId ]!;
				state.data.cardLocations[ input.cardId ] = hasCard
					? [ playerId ]
					: remove( p => p === input.from || p === playerId, possibleOwners );

				// If the opponent gave away their last card, remove them from all card locations
				if ( hasCard && state.data.cardCounts[ input.from ] <= 0 ) {
					for ( const cid of Object.keys( state.data.cardLocations ) as CardId[] ) {
						const owners = state.data.cardLocations[ cid ];
						if ( owners && owners.includes( input.from ) ) {
							state.data.cardLocations[ cid ] = owners.filter( pid => pid !== input.from );
						}
					}
				}

				logger.debug( "<< askCard()" );
				return state.data;
			}
		},

		claimBook: {
			validate: ( state, config, _playerId, input: ClaimBookInput ) => {
				logger.debug( ">> validateClaimBook()" );

				const claimedCards = Object.keys( input.claim ) as CardId[];
				if ( claimedCards.length === 0 ) {
					throw new Error( "Claim cannot be empty!" );
				}

				// All cards must belong to the same book
				const books = new Set( claimedCards.map( c => getBookForCard( c, config.type ) ) );
				if ( books.size !== 1 ) {
					throw new Error( "All cards must belong to the same book!" );
				}

				const book = [ ...books ][ 0 ];

				// The book must not already be claimed
				if ( getClaimedBooks( state.data ).includes( book ) ) {
					throw new Error( "This book has already been claimed!" );
				}

				// Must claim all cards in the book
				const allBookCards = getCardsOfBook( book, config.type );
				if ( claimedCards.length !== allBookCards.length ) {
					throw new Error( `Must claim all ${ allBookCards.length } cards in the book!` );
				}

				for ( const card of allBookCards ) {
					if ( !claimedCards.includes( card ) ) {
						throw new Error( `Missing card ${ card } from claim!` );
					}
				}

				// All claimed holders must be valid players
				for ( const pid of Object.values( input.claim ) ) {
					if ( pid && !state.ctx.players.includes( pid ) ) {
						throw new Error( `Player ${ pid } is not in this match!` );
					}
				}

				logger.debug( "<< validateClaimBook()" );
			},
			execute: ( state, config, playerId, input: ClaimBookInput ) => {
				logger.debug( ">> claimBook()" );

				const claimedCards = Object.keys( input.claim ) as CardId[];
				const book = getBookForCard( claimedCards[ 0 ], config.type );
				const allBookCards = getCardsOfBook( book, config.type );
				const playerTeamId = state.data.playerData[ playerId ].teamId;

				// Build correct claim — where each card actually is
				const correctClaim: Partial<Record<CardId, PlayerId>> = {};
				for ( const card of allBookCards ) {
					for ( const pid of state.ctx.players ) {
						if ( state.data.hands[ pid ]?.includes( card ) ) {
							correctClaim[ card ] = pid;
							break;
						}
					}
				}

				// Check if the claim is correct
				const isCorrect = allBookCards.every( card =>
					input.claim[ card ] === correctClaim[ card ]
				);

				allBookCards.forEach( card => {
					delete state.data.cardLocations[ card ];
					state.data.cardCounts[ correctClaim[ card ]! ]--;
				} );

				// Remove players with no cards from all remaining card locations
				const emptyPlayers = new Set(
					Object.keys( state.data.cardCounts ).filter( pid => state.data.cardCounts[ pid ] <= 0 )
				);
				if ( emptyPlayers.size > 0 ) {
					for ( const cardId of Object.keys( state.data.cardLocations ) as CardId[] ) {
						const owners = state.data.cardLocations[ cardId ];
						if ( owners ) {
							const filtered = owners.filter( pid => !emptyPlayers.has( pid ) );
							if ( filtered.length > 0 ) {
								state.data.cardLocations[ cardId ] = filtered;
							}
						}
					}
				}

				// Award book to the correct team
				const winningTeamId = isCorrect
					? playerTeamId
					: Object.keys( state.data.teams ).find( tid => tid !== playerTeamId )!;

				state.data.teams[ winningTeamId ].booksWon.push( book );
				state.data.teams[ winningTeamId ].score++;

				// Remove all cards of this book from all hands
				for ( const pid of state.ctx.players ) {
					state.data.hands[ pid ] = state.data.hands[ pid ].filter(
						c => !allBookCards.includes( c )
					);
				}

				state.data.playerData[ playerId ].metrics.totalClaims++;
				if ( isCorrect ) {
					state.data.playerData[ playerId ].metrics.successfulClaims++;
				}

				state.data.lastMoveType = "claim";

				state.data.claimHistory.unshift( {
					success: isCorrect,
					playerId,
					book,
					correctClaim,
					actualClaim: input.claim,
					timestamp: Date.now()
				} );

				logger.debug( "<< claimBook()" );
				return state.data;
			}
		},

		transferTurn: {
			validate: ( state, _config, playerId, input: TransferTurnInput ) => {
				logger.debug( ">> validateTransferTurn()" );

				const lastClaimWasSuccessful = state.data.lastMoveType === "claim"
					&& state.data.claimHistory.length > 0
					&& state.data.claimHistory[ 0 ].success
					&& state.data.claimHistory[ 0 ].playerId === playerId;

				if ( !lastClaimWasSuccessful ) {
					throw new Error( "You can only transfer turn after a successful claim!" );
				}

				const teamMates = getTeammates( state.data.teams, playerId );
				if ( !teamMates.includes( input.transferTo ) ) {
					throw new Error( "You can only transfer to a teammate!" );
				}

				if ( state.data.hands[ input.transferTo ]?.length === 0 ) {
					throw new Error( "Cannot transfer to a teammate with no cards!" );
				}

				logger.debug( "<< validateTransferTurn()" );
			},
			execute: ( state, _config, playerId, input: TransferTurnInput ) => {
				logger.debug( ">> transferTurn()" );

				state.data.lastMoveType = "transfer";
				state.data.transferHistory.unshift( {
					playerId,
					transferTo: input.transferTo,
					timestamp: Date.now()
				} );

				logger.debug( "<< transferTurn()" );
				return state.data;
			}
		}
	},

	botMove: ( state, config ) => {
		const signals = detectTeammateSignals( state, config );
		const weightedBooks = suggestBooks( state, config, signals );
		logger.debug( "Books Suggested: %o", weightedBooks.map( book => book.book ) );

		const isLastMoveSuccessfulClaim = state.data.lastMoveType === "claim"
			&& state.data.claimHistory[ 0 ]?.success
			&& state.data.claimHistory[ 0 ]?.playerId === state.ctx.currentPlayer;

		// After a successful claim, transfer turn to the best teammate (if any has cards)
		if ( isLastMoveSuccessfulClaim ) {
			const weightedTransfers = suggestTransfers( state, config );
			logger.debug(
				"Transfers Suggested: %o",
				weightedTransfers.map( transfer => transfer.transferTo )
			);

			if ( weightedTransfers.length > 0 ) {
				const transferTo = weightedTransfers[ 0 ].transferTo;
				logger.info( "Bot %s transferring turn to %s", state.ctx.currentPlayer, transferTo );
				return { moveType: "transferTurn", input: { transferTo, matchId: "" } };
			}

			// Fallback: any teammate with cards
			const teammates = getTeammates( state.data.teams, state.data.playerId );
			const transferTo = teammates.find( pid => state.data.cardCounts[ pid ] > 0 );
			if ( transferTo ) {
				logger.info( "Bot %s fallback transferring turn to %s", state.ctx.currentPlayer, transferTo );
				return { moveType: "transferTurn", input: { transferTo, matchId: "" } };
			}
		}

		// Try certain claims first
		const weightedClaims = suggestClaims( weightedBooks, state, config, signals );
		logger.debug( "Claims Suggested: %o", weightedClaims.map( claim => claim.book ) );

		if ( weightedClaims.length > 0 ) {
			const claim = weightedClaims[ 0 ].claim;
			logger.info( "Bot %s claiming book with cards: %o", state.ctx.currentPlayer, claim );
			return { moveType: "claimBook", input: { claim, matchId: "" } };
		}

		logger.info( "Bot %s skipping claim!", state.ctx.currentPlayer );

		// Try asking for cards
		const weightedAsks = suggestAsks( weightedBooks, state, config, signals );
		logger.debug( "Asks Suggested: %o", new Set( weightedAsks.map( ask => ask.cardId ) ) );
		if ( weightedAsks.length > 0 ) {
			const { playerId, cardId } = weightedAsks[ 0 ];
			logger.info( "Bot %s asking %s for card %s", state.ctx.currentPlayer, playerId, cardId );
			return { moveType: "askCard", input: { from: playerId, cardId, matchId: "" } };
		}

		logger.info( "Bot %s skipping ask!", state.ctx.currentPlayer );

		// Absolute fallback: claim any unclaimed book with a best-guess (avoids crashing)
		// This handles the edge case where the bot has cards but no books are with its team
		// and no asks are valid (all opponents holding the cards have 0 cards left to give).
		logger.warn( "Bot %s has no valid moves — making a desperation claim", state.ctx.currentPlayer );
		const fallbackBook = weightedBooks[ 0 ];
		if ( fallbackBook ) {
			const cardsInBook = getCardsOfBook( fallbackBook.book, config.type );
			const claim: Partial<Record<CardId, PlayerId>> = {};
			for ( const cardId of cardsInBook ) {
				const owners = state.data.cardLocations[ cardId ] ?? state.ctx.players;
				claim[ cardId ] = owners[ 0 ];
			}
			return { moveType: "claimBook", input: { claim, matchId: "" } };
		}

		// Truly nothing to do — this should be unreachable since the engine
		// auto-skips players with no cards. Throw to make the bug visible.
		throw new Error( `Bot ${ state.ctx.currentPlayer } has no available moves` );
	},

	endIf: ( state, config ) => {
		const totalBooks = config.books.length;
		const claimedCount = getClaimedBooks( state.data ).length;

		if ( claimedCount < totalBooks ) {
			return undefined;
		}

		// All books claimed — find winning team
		const teamIds = Object.keys( state.data.teams );
		const winningTeam = teamIds.reduce( ( best, tid ) =>
			state.data.teams[ tid ].score > state.data.teams[ best ].score ? tid : best
		);

		return { victory: true, winner: winningTeam };
	}
} );
