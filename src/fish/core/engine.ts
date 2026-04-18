import { detectTeammateSignals, suggestAsks, suggestBooks, suggestClaims, suggestTransfers } from "@/fish/core/bot";
import type {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishData,
	FishMoves,
	FishPlayerView,
	Metrics,
	TransferTurnInput
} from "@/fish/core/types";
import { getBookForCard, getCardsOfBook, getClaimedBooks, getOpponents, getTeammates } from "@/fish/core/utils";
import { AbstractGameEngine } from "@/shared/engine/engine";
import type { GameStructure, PlayerId } from "@/shared/engine/types";
import { remove } from "@/shared/utils/array";
import { CARD_RANKS, type CardId, generateDeck, generateHands, getCardRank } from "@/shared/utils/cards";
import { generateId } from "@/shared/utils/generator";

const DEFAULT_METRICS: Metrics = {
	totalAsks: 0,
	cardsGiven: 0,
	cardsTaken: 0,
	totalClaims: 0,
	successfulClaims: 0
};

export class FishEngine extends AbstractGameEngine<FishData, FishMoves, FishConfig, FishPlayerView> {

	public static readonly NAME = "fish";

	protected readonly structure: GameStructure<FishData, FishMoves, FishConfig, FishPlayerView> = {
		name: FishEngine.NAME,

		resolveNextPlayer: ( { state, context } ) => {
			let nextPlayer: PlayerId;

			switch ( state.lastMoveType ) {
				case "ask": {
					const lastAsk = state.askHistory[ 0 ];
					// Successful ask → same player keeps turn
					// Failed ask → turn goes to the asked opponent
					nextPlayer = lastAsk.success ? lastAsk.playerId : lastAsk.from;
					break;
				}

				case "claim": {
					const lastClaim = state.claimHistory[ 0 ];
					if ( lastClaim.success ) {
						// Successful claim → same player (can transfer or continue)
						nextPlayer = lastClaim.playerId;
						break;
					}
					// Failed claim → turn goes to an opponent with cards
					const opponents = getOpponents( state.teams, lastClaim.playerId );
					nextPlayer = opponents.find( pid => state.hands[ pid ]?.length > 0 ) ?? context.players[ 0 ];
					break;
				}

				case "transfer": {
					const lastTransfer = state.transferHistory[ 0 ];
					nextPlayer = lastTransfer.transferTo;
					break;
				}

				default:
					nextPlayer = context.currentPlayer;
			}

			// Auto-skip players with no cards — find a teammate with cards, then any player with cards
			if ( state.hands[ nextPlayer ]?.length === 0 ) {
				const teammates = getTeammates( state.teams, nextPlayer );
				const teammateWithCards = teammates.find( pid => state.hands[ pid ]?.length > 0 );
				if ( teammateWithCards ) {
					return teammateWithCards;
				}
				return context.players.find( pid => state.hands[ pid ]?.length > 0 ) ?? nextPlayer;
			}

			return nextPlayer;
		},

		playerView: ( { state }, playerId ): FishPlayerView => {
			const { hands, ...rest } = state;
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

		hooks: {
			onJoin: ( { state }, playerId ) => {
				state.playerData[ playerId ] = {
					teamId: "",
					metrics: { ...DEFAULT_METRICS }
				};
				return state;
			},

			onStart: ( { state, config, context } ) => {
				// Deal cards
				let deck = generateDeck();
				if ( config.deckType === 48 ) {
					deck = remove( ( card ) => getCardRank( card ) === CARD_RANKS.SEVEN, deck );
				}

				const hands = generateHands( deck, context.players.length );
				for ( let i = 0; i < context.players.length; i++ ) {
					state.hands[ context.players[ i ] ] = hands[ i ];
					state.cardCounts[ context.players[ i ] ] = hands[ i ].length;
				}

				state.cardLocations = deck.reduce(
					( acc, card ) => {
						acc[ card ] = context.players;
						return acc;
					},
					{} as Partial<Record<CardId, PlayerId[]>>
				);

				return state;
			},

			onEnd: ( { state } ) => {
				const teamIds = Object.keys( state.teams );
				state.winningTeam = teamIds.reduce( ( best, tid ) =>
					state.teams[ tid ].score > state.teams[ best ].score ? tid : best
				);

				return state;
			}
		},

		moves: {
			createTeams: {
				validate: ( { state, config }, _playerId, input: CreateTeamsInput ) => {
					this.logger.debug( ">> validateCreateTeams()" );

					if ( Object.keys( state.teams ).length > 0 ) {
						this.logger.error( "Teams have already been created!" );
						throw new Error( "Teams have already been created!" );
					}

					const teamCount = Object.keys( input.teams ).length;
					if ( teamCount !== config.teamCount ) {
						this.logger.error( "Team count does not game the game configuration!" );
						throw new Error( "Team count does not game the game configuration!" );
					}

					const playersSpecified = new Set( Object.values( input.teams ).flat() );
					if ( playersSpecified.size !== config.playerCount ) {
						this.logger.error( "Not all players are divided into teams!" );
						throw new Error( "Not all players are divided into teams!" );
					}

					const playersPerTeam = config.playerCount / teamCount;
					for ( const [ teamName, playerIds ] of Object.entries( input.teams ) ) {
						if ( playerIds.length !== playersPerTeam ) {
							this.logger.error( "Invalid number of players in team %s!", teamName );
							throw new Error( `Invalid number of players in team ${ teamName }!` );
						}

						for ( const playerId of playerIds ) {
							if ( !state.playerData[ playerId ] ) {
								this.logger.error( "Player %s is not part of the game!", playerId );
								throw new Error( `Player ${ playerId } is not part of the game!` );
							}
						}
					}

					this.logger.debug( "<< validateCreateTeams()" );
				},
				execute: ( { state }, _playerId, input: CreateTeamsInput ) => {
					this.logger.debug( ">> createTeams()" );

					Object.entries( input.teams ).forEach( ( [ name, members ] ) => {
						const id = generateId();
						state.teams[ id ] = { id, name, members, score: 0, booksWon: [] };
						members.forEach( playerId => {
							state.playerData[ playerId ].teamId = id;
						} );
					} );

					this.logger.debug( "<< createTeams()" );
					return state;
				}
			},

			askCard: {
				validate: ( { state, config }, playerId, input: AskCardInput ) => {
					this.logger.debug( ">> validateAskCard()" );

					const hand = state.hands[ playerId ];
					if ( !hand || hand.length === 0 ) {
						throw new Error( "You have no cards! Transfer your turn instead." );
					}

					// Must ask an opponent
					const opponents = getOpponents( state.teams, playerId );
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
					if ( getClaimedBooks( state ).includes( book ) ) {
						throw new Error( "This book has already been claimed!" );
					}

					this.logger.debug( "<< validateAskCard()" );
				},
				execute: ( { state }, playerId, input: AskCardInput ) => {
					this.logger.debug( ">> askCard()" );

					const opponentHand = state.hands[ input.from ];
					const hasCard = opponentHand.includes( input.cardId );

					if ( hasCard ) {
						// Transfer card from opponent to asking player
						state.hands[ input.from ] = opponentHand.filter( c => c !== input.cardId );
						state.cardCounts[ input.from ]--;
						state.playerData[ input.from ].metrics.cardsGiven++;

						state.hands[ playerId ].push( input.cardId );
						state.cardCounts[ playerId ]++;
						state.playerData[ playerId ].metrics.cardsTaken++;
					}

					state.playerData[ playerId ].metrics.totalAsks++;
					state.lastMoveType = "ask";

					state.askHistory.unshift( {
						success: hasCard,
						playerId,
						from: input.from,
						cardId: input.cardId,
						timestamp: Date.now()
					} );

					const possibleOwners = state.cardLocations[ input.cardId ]!;
					state.cardLocations[ input.cardId ] = hasCard
						? [ playerId ]
						: remove( p => p === input.from || p === playerId, possibleOwners );

					// If the opponent gave away their last card, remove them from all card locations
					if ( hasCard && state.cardCounts[ input.from ] <= 0 ) {
						for ( const cid of Object.keys( state.cardLocations ) as CardId[] ) {
							const owners = state.cardLocations[ cid ];
							if ( owners && owners.includes( input.from ) ) {
								state.cardLocations[ cid ] = owners.filter( pid => pid !== input.from );
							}
						}
					}

					this.logger.debug( "<< askCard()" );
					return state;
				}
			},

			claimBook: {
				validate: ( { state, config, context }, _playerId, input: ClaimBookInput ) => {
					this.logger.debug( ">> validateClaimBook()" );

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
					if ( getClaimedBooks( state ).includes( book ) ) {
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
						if ( pid && !context.players.includes( pid ) ) {
							throw new Error( `Player ${ pid } is not in this game!` );
						}
					}

					this.logger.debug( "<< validateClaimBook()" );
				},
				execute: ( { state, config, context }, playerId, input: ClaimBookInput ) => {
					this.logger.debug( ">> claimBook()" );

					const claimedCards = Object.keys( input.claim ) as CardId[];
					const book = getBookForCard( claimedCards[ 0 ], config.type );
					const allBookCards = getCardsOfBook( book, config.type );
					const playerTeamId = state.playerData[ playerId ].teamId;

					// Build correct claim — where each card actually is
					const correctClaim: Partial<Record<CardId, PlayerId>> = {};
					for ( const card of allBookCards ) {
						for ( const pid of context.players ) {
							if ( state.hands[ pid ]?.includes( card ) ) {
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
						delete state.cardLocations[ card ];
						state.cardCounts[ correctClaim[ card ]! ]--;
					} );

					// Remove players with no cards from all remaining card locations
					const emptyPlayers = new Set(
						Object.keys( state.cardCounts ).filter( pid => state.cardCounts[ pid ] <= 0 )
					);
					if ( emptyPlayers.size > 0 ) {
						for ( const cardId of Object.keys( state.cardLocations ) as CardId[] ) {
							const owners = state.cardLocations[ cardId ];
							if ( owners ) {
								const filtered = owners.filter( pid => !emptyPlayers.has( pid ) );
								if ( filtered.length > 0 ) {
									state.cardLocations[ cardId ] = filtered;
								}
							}
						}
					}

					// Award book to the correct team
					const winningTeamId = isCorrect
						? playerTeamId
						: Object.keys( state.teams ).find( tid => tid !== playerTeamId )!;

					state.teams[ winningTeamId ].booksWon.push( book );
					state.teams[ winningTeamId ].score++;

					// Remove all cards of this book from all hands
					for ( const pid of context.players ) {
						state.hands[ pid ] = state.hands[ pid ].filter(
							c => !allBookCards.includes( c )
						);
					}

					state.playerData[ playerId ].metrics.totalClaims++;
					if ( isCorrect ) {
						state.playerData[ playerId ].metrics.successfulClaims++;
					}

					state.lastMoveType = "claim";

					state.claimHistory.unshift( {
						success: isCorrect,
						playerId,
						book,
						correctClaim,
						actualClaim: input.claim,
						timestamp: Date.now()
					} );

					this.logger.debug( "<< claimBook()" );
					return state;
				}
			},

			transferTurn: {
				validate: ( { state }, playerId, input: TransferTurnInput ) => {
					this.logger.debug( ">> validateTransferTurn()" );

					const lastClaimWasSuccessful = state.lastMoveType === "claim"
						&& state.claimHistory.length > 0
						&& state.claimHistory[ 0 ].success
						&& state.claimHistory[ 0 ].playerId === playerId;

					if ( !lastClaimWasSuccessful ) {
						throw new Error( "You can only transfer turn after a successful claim!" );
					}

					const teamMates = getTeammates( state.teams, playerId );
					if ( !teamMates.includes( input.transferTo ) ) {
						throw new Error( "You can only transfer to a teammate!" );
					}

					if ( state.hands[ input.transferTo ]?.length === 0 ) {
						throw new Error( "Cannot transfer to a teammate with no cards!" );
					}

					this.logger.debug( "<< validateTransferTurn()" );
				},
				execute: ( { state }, playerId, input: TransferTurnInput ) => {
					this.logger.debug( ">> transferTurn()" );

					state.lastMoveType = "transfer";
					state.transferHistory.unshift( {
						playerId,
						transferTo: input.transferTo,
						timestamp: Date.now()
					} );

					this.logger.debug( "<< transferTurn()" );
					return state;
				}
			}
		},

		botMove: ( { state, config, context } ) => {
			const signals = detectTeammateSignals( state, config );
			const weightedBooks = suggestBooks( state, config, signals );
			this.logger.debug( "Books Suggested: %o", weightedBooks.map( book => book.book ) );

			const isLastMoveSuccessfulClaim = state.lastMoveType === "claim"
				&& state.claimHistory[ 0 ]?.success
				&& state.claimHistory[ 0 ]?.playerId === context.currentPlayer;

			// After a successful claim, transfer turn to the best teammate (if any has cards)
			if ( isLastMoveSuccessfulClaim ) {
				const weightedTransfers = suggestTransfers( state, config );
				this.logger.debug(
					"Transfers Suggested: %o",
					weightedTransfers.map( transfer => transfer.transferTo )
				);

				if ( weightedTransfers.length > 0 ) {
					const transferTo = weightedTransfers[ 0 ].transferTo;
					this.logger.info( "Bot %s transferring turn to %s", context.currentPlayer, transferTo );
					return { moveType: "transferTurn", input: { transferTo, gameId: "" } };
				}

				// Fallback: any teammate with cards
				const teammates = getTeammates( state.teams, state.playerId );
				const transferTo = teammates.find( pid => state.cardCounts[ pid ] > 0 );
				if ( transferTo ) {
					this.logger.info( "Bot %s fallback transferring turn to %s", context.currentPlayer, transferTo );
					return { moveType: "transferTurn", input: { transferTo, gameId: "" } };
				}
			}

			// Try certain claims first
			const weightedClaims = suggestClaims( weightedBooks, state, config, signals );
			this.logger.debug( "Claims Suggested: %o", weightedClaims.map( claim => claim.book ) );

			if ( weightedClaims.length > 0 ) {
				const claim = weightedClaims[ 0 ].claim;
				this.logger.info( "Bot %s claiming book with cards: %o", context.currentPlayer, claim );
				return { moveType: "claimBook", input: { claim, gameId: "" } };
			}

			this.logger.info( "Bot %s skipping claim!", context.currentPlayer );

			// Try asking for cards
			const weightedAsks = suggestAsks( weightedBooks, state, config, signals );
			this.logger.debug( "Asks Suggested: %o", new Set( weightedAsks.map( ask => ask.cardId ) ) );
			if ( weightedAsks.length > 0 ) {
				const { playerId, cardId } = weightedAsks[ 0 ];
				this.logger.info( "Bot %s asking %s for card %s", context.currentPlayer, playerId, cardId );
				return { moveType: "askCard", input: { from: playerId, cardId, gameId: "" } };
			}

			this.logger.info( "Bot %s skipping ask!", context.currentPlayer );

			// Absolute fallback: claim any unclaimed book with a best-guess (avoids crashing)
			// This handles the edge case where the bot has cards but no books are with its team
			// and no asks are valid (all opponents holding the cards have 0 cards left to give).
			this.logger.warn( "Bot %s has no valid moves — making a desperation claim", context.currentPlayer );
			const fallbackBook = weightedBooks[ 0 ];
			if ( fallbackBook ) {
				const cardsInBook = getCardsOfBook( fallbackBook.book, config.type );
				const claim: Partial<Record<CardId, PlayerId>> = {};
				for ( const cardId of cardsInBook ) {
					const owners = state.cardLocations[ cardId ] ?? context.players;
					claim[ cardId ] = owners[ 0 ];
				}
				return { moveType: "claimBook", input: { claim, gameId: "" } };
			}

			// Truly nothing to do — this should be unreachable since the engine
			// auto-skips players with no cards. Throw to make the bug visible.
			throw new Error( `Bot ${ context.currentPlayer } has no available moves` );
		},

		endIf: ( { state, config } ) => {
			const totalBooks = config.books.length;
			const claimedCount = getClaimedBooks( state ).length;
			return claimedCount < totalBooks;
		}
	};

}