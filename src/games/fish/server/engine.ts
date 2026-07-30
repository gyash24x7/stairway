import type {
	FishSnapshot} from "@/games/fish/shared/schema.ts";
import {
	AskCardInput,
	BookClaimed,
	CardAsked,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishEvent,
	FishPlayerView,
	FishState,
	FishTableView,
	FishView,
	HandsDealt,
	PlayerSeated,
	TeamsCreated,
	TransferTurnInput,
	TurnTransferred,
	WinningTeamDecided
} from "@/games/fish/shared/schema.ts";
import {
	getBookForCard,
	getCardsOfBook,
	getClaimedBooks,
	getOpponents,
	getTeammates
} from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import { CARD_RANKS, generateDeck, generateHands, getCardRank } from "@/shared/cards/utils.ts";
import { makeEngine } from "@/shared/swish/engine.ts";
import { InvalidMove } from "@/shared/swish/errors.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";
import { defineView } from "@/shared/swish/views.ts";
import { remove } from "@/shared/utils/array.ts";
import { generateId } from "@/shared/utils/generator.ts";
import {
	detectTeammateSignals,
	suggestAsks,
	suggestBooks,
	suggestClaims,
	suggestTransfers
} from "@/games/fish/server/bot.ts";
import { apply } from "@/games/fish/server/utils.ts";

/** Whether a player has been seated (has playerData). */
const playerSeated = ( state: typeof FishState.Type, pid: PlayerId ) =>
	state.playerData[ pid ] !== undefined;

// --- Engine ----------------------------------------------------------------

export const fish = makeEngine( {
	name: "fish",
	schemas: {
		state: FishState,
		config: FishConfig,
		events: FishEvent,
		view: FishView,
		moves: {
			createTeams: CreateTeamsInput,
			askCard: AskCardInput,
			claimBook: ClaimBookInput,
			transferTurn: TransferTurnInput
		}
	},

	setup: () => ( {
		playerData: {},
		teams: {},
		hands: {},
		cardCounts: {},
		cardLocations: {},
		askHistory: [],
		claimHistory: [],
		transferHistory: []
	} ),

	apply,

	endIf: ( { state, config } ) => getClaimedBooks( state ).length === config.books.length,

	view: defineView( {
		table: ( { state } ) => {
			const { hands: _hands, ...rest } = state;
			return FishTableView.make( rest );
		},
		player: ( { state }, id ) => {
			const { hands: _hands, ...rest } = state;
			return FishPlayerView.make( {
				...rest,
				playerId: id,
				hand: [ ...( state.hands[ id ] ?? [] ) ]
			} );
		}
	} ),

	hooks: {
		// A joining player's `playerData` seat is created here (mirrors old onJoin).
		onJoin: ( { state }, playerId ) =>
			state.playerData[ playerId ] ? [] : [ PlayerSeated.make( { playerId } ) ],

		onEnd: ( { state } ) => {
			const teamIds = Object.keys( state.teams );
			if ( teamIds.length === 0 ) {
				return [];
			}

			const best = teamIds.reduce( ( acc, tid ) =>
				state.teams[ tid ].score > state.teams[ acc ].score ? tid : acc
			);

			return [ WinningTeamDecided.make( { teamId: best } ) ];
		}
	},

	initialPhase: "TEAM_CONFIG",

	moves: {
		createTeams: {
			phase: "TEAM_CONFIG",

			validate: ( { state, config }, _playerId, input ) => {
				if ( Object.keys( state.teams ).length > 0 ) {
					return new InvalidMove( {
						move: "createTeams",
						reason: "Teams have already been created!"
					} );
				}

				const teamCount = Object.keys( input.teams ).length;
				if ( teamCount !== config.teamCount ) {
					return new InvalidMove( {
						move: "createTeams",
						reason: "Team count does not match the game config!"
					} );
				}

				const playersSpecified = new Set( Object.values( input.teams ).flat() );
				if ( playersSpecified.size !== config.playerCount ) {
					return new InvalidMove( {
						move: "createTeams",
						reason: "Not all players are divided into teams!"
					} );
				}

				const playersPerTeam = config.playerCount / teamCount;
				for ( const teamName of Object.keys( input.teams ) ) {
					const playerIds: ReadonlyArray<PlayerId> = input.teams[ teamName ] ?? [];
					if ( playerIds.length !== playersPerTeam ) {
						return new InvalidMove( {
							move: "createTeams",
							reason: `Invalid number of players in team ${ teamName }!`
						} );
					}

					for ( const pid of playerIds ) {
						if ( !playerSeated( state, pid ) ) {
							return new InvalidMove( {
								move: "createTeams",
								reason: `Player ${ pid } is not part of the game!`
							} );
						}
					}
				}

				return undefined;
			},

			execute: ( _data, _playerId, input ) =>
				[
					TeamsCreated.make( {
						teams: Object.keys( input.teams ).map(
							name => ( { id: generateId(), name, members: input.teams[ name ] } )
						)
					} )
				]
		},

		askCard: {
			phase: "PLAY",

			validate: ( { state, config }, playerId, input ) => {
				const hand = state.hands[ playerId ];
				if ( !hand || hand.length === 0 ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You have no cards! Transfer your turn instead."
					} );
				}

				const opponents = getOpponents( state.teams, playerId );
				if ( !opponents.includes( input.from ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You can only ask opponents for cards!"
					} );
				}

				const book = getBookForCard( input.cardId, config.type );
				const hasCardFromBook = hand.some( c => getBookForCard( c, config.type ) === book );
				if ( !hasCardFromBook ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You must hold atleast 1 card from the book!"
					} );
				}

				if ( hand.includes( input.cardId ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You already have this card!"
					} );
				}

				if ( getClaimedBooks( state ).includes( book ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "This book has already been claimed!"
					} );
				}

				return undefined;
			},

			execute: ( { state }, playerId, input ) => {
				const timestamp = Date.now();
				const success = ( state.hands[ input.from ] ?? [] ).includes( input.cardId );
				return [ CardAsked.make( { success, playerId, timestamp, ...input } ) ];
			}
		},

		claimBook: {
			phase: "PLAY",

			validate: ( { state, config, context }, _playerId, input ) => {
				const claimedCards = Object.keys( input.claim ) as CardId[];
				if ( claimedCards.length === 0 ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "Claim cannot be empty!"
					} );
				}

				const books = new Set( claimedCards.map( c => getBookForCard( c, config.type ) ) );
				if ( books.size !== 1 ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "All cards must belong to the same book!"
					} );
				}

				const book = [ ...books ][ 0 ];
				if ( getClaimedBooks( state ).includes( book ) ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "This book has already been claimed!"
					} );
				}

				const allBookCards = getCardsOfBook( book, config.type );
				if ( claimedCards.length !== allBookCards.length ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: `Must claim all ${ allBookCards.length } cards in the book!`
					} );
				}

				for ( const card of allBookCards ) {
					if ( !claimedCards.includes( card ) ) {
						return new InvalidMove( {
							move: "claimBook",
							reason: `Missing card ${ card } from claim!`
						} );
					}
				}

				for ( const card of Object.keys( input.claim ) ) {
					const pid = input.claim[ card ] as PlayerId | undefined;
					if ( pid && !context.players.includes( pid ) ) {
						return new InvalidMove( {
							move: "claimBook",
							reason: `Player ${ pid } is not in this game!`
						} );
					}
				}

				return undefined;
			},
			execute: ( { state, config }, playerId, input ) => {
				const timestamp = Date.now();
				const claimedCards = Object.keys( input.claim ) as CardId[];
				const book = getBookForCard( claimedCards[ 0 ], config.type );
				const allBookCards = getCardsOfBook( book, config.type );
				const playerTeamId = state.playerData[ playerId ].teamId;

				const correctClaim: Record<string, PlayerId> = {};
				for ( const card of allBookCards ) {
					for ( const pid of Object.keys( state.hands ) as PlayerId[] ) {
						if ( ( state.hands[ pid ] ?? [] ).includes( card ) ) {
							correctClaim[ card ] = pid;
							break;
						}
					}
				}

				const success = allBookCards.every( card =>
					input.claim[ card ] === correctClaim[ card ]
				);

				const winningTeamId = success
					? playerTeamId
					: Object.keys( state.teams ).find( tid => tid !== playerTeamId )!;

				return [
					BookClaimed.make( {
						success,
						playerId,
						book,
						winningTeamId,
						correctClaim,
						actualClaim: input.claim,
						timestamp
					} )
				];
			}
		},

		transferTurn: {
			phase: "PLAY",

			validate: ( { state }, playerId, input ) => {
				const lastClaimWasSuccessful = state.lastMoveType === "claim"
					&& state.claimHistory.length > 0
					&& state.claimHistory[ 0 ].success
					&& state.claimHistory[ 0 ].playerId === playerId;

				if ( !lastClaimWasSuccessful ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "You can only transfer turn after a successful claim!"
					} );
				}

				const teamMates = getTeammates( state.teams, playerId );
				if ( !teamMates.includes( input.transferTo ) ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "You can only transfer to a teammate!"
					} );
				}

				if ( ( state.hands[ input.transferTo ] ?? [] ).length === 0 ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "Cannot transfer to a teammate with no cards!"
					} );
				}

				return undefined;
			},
			execute: ( _data, playerId, input ) => {
				const timestamp = Date.now();
				return [ TurnTransferred.make( { playerId, transferTo: input.transferTo, timestamp } ) ];
			}
		}
	},

	phases: {
		TEAM_CONFIG: {
			moves: [ "createTeams" ],
			resolveNextPlayer: ( { context } ) => context.currentPlayer,
			endIf: ( { state } ) => Object.keys( state.teams ).length > 0,
			resolveNextPhase: () => "PLAY"
		},

		PLAY: {
			moves: [ "askCard", "claimBook", "transferTurn" ],

			// The deck shuffle/deal is nondeterministic — done here and captured in
			// the HandsDealt event so replay is exact.
			onEnter: ( { config, context } ) => {
				let deck = generateDeck();
				if ( config.deckType === 48 ) {
					deck = remove( card => getCardRank( card ) === CARD_RANKS.SEVEN, deck );
				}

				const dealt = generateHands( deck, context.players.length );
				const hands: Record<PlayerId, CardId[]> = {};
				const cardCounts: Record<PlayerId, number> = {};

				for ( let i = 0; i < context.players.length; i++ ) {
					hands[ context.players[ i ] ] = dealt[ i ];
					cardCounts[ context.players[ i ] ] = dealt[ i ].length;
				}

				const cardLocations: Record<string, PlayerId[]> = {};
				for ( const card of deck ) {
					cardLocations[ card ] = [ ...context.players ];
				}

				return [ HandsDealt.make( { hands, cardCounts, cardLocations } ) ];
			},

			resolveNextPlayer: ( { state, context } ) => {
				let nextPlayer: PlayerId;

				switch ( state.lastMoveType ) {
					case "ask": {
						const lastAsk = state.askHistory[ 0 ];
						nextPlayer = lastAsk.success ? lastAsk.playerId : lastAsk.from;
						break;
					}
					case "claim": {
						const lastClaim = state.claimHistory[ 0 ];
						if ( lastClaim.success ) {
							nextPlayer = lastClaim.playerId;
							break;
						}

						const opponents = getOpponents( state.teams, lastClaim.playerId );
						nextPlayer = opponents.find( pid => ( state.hands[ pid ].length ?? 0 ) > 0 )
							?? context.players[ 0 ];

						break;
					}
					case "transfer": {
						const lastTransfer = state.transferHistory[ 0 ];
						nextPlayer = lastTransfer.transferTo;
						break;
					}
					default: {
						nextPlayer = context.currentPlayer;
					}
				}

				if ( ( state.hands[ nextPlayer ]?.length ?? 0 ) === 0 ) {
					const teammateWithCards = getTeammates( state.teams, nextPlayer ).find(
						pid => ( state.hands[ pid ]?.length ?? 0 ) > 0
					);

					if ( teammateWithCards ) {
						return teammateWithCards;
					}

					return context.players.find( pid => ( state.hands[ pid ]?.length ?? 0 ) > 0 )
						?? nextPlayer;
				}

				return nextPlayer;
			},

			endIf: () => false,
			resolveNextPhase: () => "PLAY"
		}
	},

	botMove: ( snapshot ) => fishBotMove( snapshot )
} );

/**
 * Pick the bot's move from a game snapshot. Reads the current phase from
 * `context.phase`, rebuilds a `FishBotView` for the AI helpers, and returns the
 * same move shapes the old per-phase `botMove` produced (now plain values).
 */
function fishBotMove( snapshot: typeof FishSnapshot.Type ) {
	const phase = snapshot.context.phase;
	const config = snapshot.config;

	if ( snapshot.view._tag !== "fish/PlayerView" ) {
		return undefined;
	}

	if ( phase === "PLAY" ) {
		const view = snapshot.view;

		const signals = detectTeammateSignals( view, config );
		const weightedBooks = suggestBooks( view, config, signals );

		const isLastMoveSuccessfulClaim = view.lastMoveType === "claim"
			&& view.claimHistory[ 0 ]?.success
			&& view.claimHistory[ 0 ]?.playerId === snapshot.context.currentPlayer;

		if ( isLastMoveSuccessfulClaim ) {
			const weightedTransfers = suggestTransfers( view, config );
			if ( weightedTransfers.length > 0 ) {
				return {
					moveType: "transferTurn" as const,
					input: { transferTo: weightedTransfers[ 0 ].transferTo }
				};
			}

			const teammates = getTeammates( view.teams, view.playerId );
			const transferTo = teammates.find( pid => ( view.cardCounts[ pid ] ?? 0 ) > 0 );
			if ( transferTo ) {
				return {
					moveType: "transferTurn" as const,
					input: { transferTo }
				};
			}
		}

		const weightedClaims = suggestClaims( weightedBooks, view, config, signals );
		if ( weightedClaims.length > 0 ) {
			return {
				moveType: "claimBook" as const,
				input: { claim: weightedClaims[ 0 ].claim as Record<string, PlayerId> }
			};
		}

		const weightedAsks = suggestAsks( weightedBooks, view, config, signals );
		if ( weightedAsks.length > 0 ) {
			const { playerId, cardId } = weightedAsks[ 0 ];
			return {
				moveType: "askCard" as const,
				input: { from: playerId, cardId }
			};
		}

		const fallbackBook = weightedBooks[ 0 ];
		if ( fallbackBook ) {
			const cardsInBook = getCardsOfBook( fallbackBook.book, config.type );
			const claim: Record<string, PlayerId> = {};
			for ( const cardId of cardsInBook ) {
				const owners = view.cardLocations[ cardId ] ?? snapshot.context.players;
				claim[ cardId ] = owners[ 0 ];
			}

			return {
				moveType: "claimBook" as const,
				input: { claim: claim as Record<string, PlayerId> }
			};
		}

		// No available move — last resort: an empty claim keeps the engine
		// progressing (resolves to the opponents on a failed claim).
		return {
			moveType: "claimBook" as const,
			input: { claim: {} as Record<string, PlayerId> }
		};
	}

	// TEAM_CONFIG (or default): evenly divide the players into `teamCount` teams.
	const players = Object.keys( snapshot.players ) as PlayerId[];
	const teamCount = config.teamCount;
	const perTeam = players.length / teamCount;
	const teams: Record<string, PlayerId[]> = {};
	for ( let t = 0; t < teamCount; t++ ) {
		teams[ `Team ${ t + 1 }` ] = players.slice( t * perTeam, ( t + 1 ) * perTeam );
	}
	return {
		moveType: "createTeams" as const,
		input: { teams }
	};
}
