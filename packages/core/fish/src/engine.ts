// @s2h/fish/engine — Fish (Literature) as an event-sourced swish game.
//
// The swish engine for Fish: moves/hooks/phase transitions EMIT domain events
// and the pure `apply` reducer (in ./utils) folds them onto `state` (the only
// place state changes). Nondeterminism (team ids, deck shuffle/deal, timestamps)
// is produced in the deciders and CAPTURED in the emitted event payloads so
// replay is exact. Fish is a phased game (TEAM_CONFIG → PLAY) with bots.

import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { definePhasedGame } from "@s2h/swish/structure";
import { remove } from "@s2h/utils/array";
import { CARD_RANKS, type CardId, generateDeck, generateHands, getCardRank } from "@s2h/utils/cards";
import { generateId } from "@s2h/utils/generator";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import {
	detectTeammateSignals,
	suggestAsks,
	suggestBooks,
	suggestClaims,
	suggestTransfers
} from "./bot";
import {
	AskCardInput,
	BookClaimed,
	Card,
	CardAsked,
	ClaimBookInput,
	CreateTeamsInput,
	FishBotView,
	FishConfig,
	FishEvent,
	FishPlayerView,
	FishSharedView,
	FishSnapshot,
	FishState,
	HandsDealt,
	PlayerSeated,
	TeamsCreated,
	TransferTurnInput,
	TurnTransferred,
	WinningTeamDecided
} from "./schema";
import {
	apply,
	getBookForCard,
	getCardsOfBook,
	getClaimedBooks,
	getOpponents,
	getTeammates
} from "./utils";

type CardT = typeof Card.Type;

/** Whether a player has been seated (has playerData). */
const playerSeated = ( state: typeof FishState.Type, pid: PlayerId ): boolean =>
	state.playerData[ pid ] !== undefined;

// --- Engine ----------------------------------------------------------------

export const fish = makeEngine(
	definePhasedGame( {
		name: "fish",
		stateSchema: FishState,
		configSchema: FishConfig,
		sharedViewSchema: FishSharedView,
		playerViewSchema: FishPlayerView,
		eventSchema: FishEvent,
		apply,

		setup: () => Effect.succeed( {
			playerData: {},
			teams: {},
			hands: {},
			cardCounts: {},
			cardLocations: {},
			askHistory: [],
			claimHistory: [],
			transferHistory: []
		} ),

		sharedView: ( { state } ) => {
			const { hands: _hands, ...rest } = state;
			return Effect.succeed( rest );
		},

		playerView: ( { state }, playerId ) =>
			Effect.succeed( { playerId, hand: [ ...( state.hands[ playerId ] ?? [] ) ] } ),

		endIf: ( { state, config } ) =>
			Effect.succeed( getClaimedBooks( state ).length === config.books.length ),

		hooks: {
			// A joining player's `playerData` seat is created here (mirrors old onJoin).
			onJoin: ( { state }, playerId ) =>
				state.playerData[ playerId ]
					? Effect.succeed( [] )
					: Effect.succeed( [ PlayerSeated.make( { playerId } ) ] ),
			onEnd: ( { state } ) => {
				const teamIds = Object.keys( state.teams );
				if ( teamIds.length === 0 ) {
					return Effect.succeed( [] );
				}
				const best = teamIds.reduce( ( acc, tid ) =>
					state.teams[ tid ].score > state.teams[ acc ].score ? tid : acc
				);
				return Effect.succeed( [ WinningTeamDecided.make( { teamId: best } ) ] );
			}
		},

		initialPhase: "TEAM_CONFIG",

		phases: {
			TEAM_CONFIG: {
				moves: {
					createTeams: {
						input: CreateTeamsInput,
						validate: ( { state, config }, _playerId, input ) => {
							if ( Object.keys( state.teams ).length > 0 ) {
								return Effect.fail( new InvalidMove( { move: "createTeams", reason: "Teams have already been created!" } ) );
							}
							const teamCount = Object.keys( input.teams ).length;
							if ( teamCount !== config.teamCount ) {
								return Effect.fail( new InvalidMove( { move: "createTeams", reason: "Team count does not match the game config!" } ) );
							}
							const playersSpecified = new Set( Object.values( input.teams ).flat() );
							if ( playersSpecified.size !== config.playerCount ) {
								return Effect.fail( new InvalidMove( { move: "createTeams", reason: "Not all players are divided into teams!" } ) );
							}
							const playersPerTeam = config.playerCount / teamCount;
							for ( const teamName of Object.keys( input.teams ) ) {
								const playerIds: ReadonlyArray<PlayerId> = input.teams[ teamName ] ?? [];
								if ( playerIds.length !== playersPerTeam ) {
									return Effect.fail( new InvalidMove( { move: "createTeams", reason: `Invalid number of players in team ${ teamName }!` } ) );
								}
								for ( const pid of playerIds ) {
									if ( !playerSeated( state, pid ) ) {
										return Effect.fail( new InvalidMove( { move: "createTeams", reason: `Player ${ pid } is not part of the game!` } ) );
									}
								}
							}
							return Effect.void;
						},
						execute: ( _data, _playerId, input ) =>
							Effect.succeed( [ TeamsCreated.make( {
								teams: Object.keys( input.teams ).map( ( name ) => ( {
									id: generateId(),
									name,
									members: [ ...( input.teams[ name ] ?? [] ) ]
								} ) )
							} ) ] )
					}
				},

				resolveNextPlayer: ( { context } ) => Effect.succeed( context.currentPlayer ),
				endIf: ( { state } ) => Effect.succeed( Object.keys( state.teams ).length > 0 ),
				resolveNextPhase: () => Effect.succeed( "PLAY" )
			},

			PLAY: {
				// The deck shuffle/deal is nondeterministic — done here and captured in
				// the HandsDealt event so replay is exact.
				onEnter: ( { config, context } ) =>
					Effect.sync( () => {
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
					} ),

				moves: {
					askCard: {
						input: AskCardInput,
						validate: ( { state, config }, playerId, input ) => {
							const hand = state.hands[ playerId ];
							if ( !hand || hand.length === 0 ) {
								return Effect.fail( new InvalidMove( { move: "askCard", reason: "You have no cards! Transfer your turn instead." } ) );
							}
							const opponents = getOpponents( state.teams, playerId );
							if ( !opponents.includes( input.from ) ) {
								return Effect.fail( new InvalidMove( { move: "askCard", reason: "You can only ask opponents for cards!" } ) );
							}
							const book = getBookForCard( input.cardId, config.type );
							const hasCardFromBook = hand.some( c => getBookForCard( c, config.type ) === book );
							if ( !hasCardFromBook ) {
								return Effect.fail( new InvalidMove( { move: "askCard", reason: "You must hold atleast 1 card from the book!" } ) );
							}
							if ( hand.includes( input.cardId ) ) {
								return Effect.fail( new InvalidMove( { move: "askCard", reason: "You already have this card!" } ) );
							}
							if ( getClaimedBooks( state ).includes( book ) ) {
								return Effect.fail( new InvalidMove( { move: "askCard", reason: "This book has already been claimed!" } ) );
							}
							return Effect.void;
						},
						execute: ( { state }, playerId, input ) =>
							Effect.gen( function* () {
								const timestamp = yield* Clock.currentTimeMillis;
								const success = ( state.hands[ input.from ] ?? [] ).includes( input.cardId );
								return [ CardAsked.make( {
									success,
									playerId,
									from: input.from,
									cardId: input.cardId,
									timestamp
								} ) ];
							} )
					},

					claimBook: {
						input: ClaimBookInput,
						validate: ( { state, config, context }, _playerId, input ) => {
							const claimedCards = Object.keys( input.claim ) as CardId[];
							if ( claimedCards.length === 0 ) {
								return Effect.fail( new InvalidMove( { move: "claimBook", reason: "Claim cannot be empty!" } ) );
							}
							const books = new Set( claimedCards.map( c => getBookForCard( c, config.type ) ) );
							if ( books.size !== 1 ) {
								return Effect.fail( new InvalidMove( { move: "claimBook", reason: "All cards must belong to the same book!" } ) );
							}
							const book = [ ...books ][ 0 ];
							if ( getClaimedBooks( state ).includes( book ) ) {
								return Effect.fail( new InvalidMove( { move: "claimBook", reason: "This book has already been claimed!" } ) );
							}
							const allBookCards = getCardsOfBook( book, config.type );
							if ( claimedCards.length !== allBookCards.length ) {
								return Effect.fail( new InvalidMove( { move: "claimBook", reason: `Must claim all ${ allBookCards.length } cards in the book!` } ) );
							}
							for ( const card of allBookCards ) {
								if ( !claimedCards.includes( card ) ) {
									return Effect.fail( new InvalidMove( { move: "claimBook", reason: `Missing card ${ card } from claim!` } ) );
								}
							}
							for ( const card of Object.keys( input.claim ) ) {
								const pid = input.claim[ card ] as PlayerId | undefined;
								if ( pid && !context.players.includes( pid ) ) {
									return Effect.fail( new InvalidMove( { move: "claimBook", reason: `Player ${ pid } is not in this game!` } ) );
								}
							}
							return Effect.void;
						},
						execute: ( { state, config }, playerId, input ) =>
							Effect.gen( function* () {
								const timestamp = yield* Clock.currentTimeMillis;
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

								return [ BookClaimed.make( {
									success,
									playerId,
									book,
									winningTeamId,
									correctClaim,
									actualClaim: { ...input.claim },
									timestamp
								} ) ];
							} )
					},

					transferTurn: {
						input: TransferTurnInput,
						validate: ( { state }, playerId, input ) => {
							const lastClaimWasSuccessful = state.lastMoveType === "claim"
								&& state.claimHistory.length > 0
								&& state.claimHistory[ 0 ].success
								&& state.claimHistory[ 0 ].playerId === playerId;
							if ( !lastClaimWasSuccessful ) {
								return Effect.fail( new InvalidMove( { move: "transferTurn", reason: "You can only transfer turn after a successful claim!" } ) );
							}
							const teamMates = getTeammates( state.teams, playerId );
							if ( !teamMates.includes( input.transferTo ) ) {
								return Effect.fail( new InvalidMove( { move: "transferTurn", reason: "You can only transfer to a teammate!" } ) );
							}
							if ( ( state.hands[ input.transferTo ] ?? [] ).length === 0 ) {
								return Effect.fail( new InvalidMove( { move: "transferTurn", reason: "Cannot transfer to a teammate with no cards!" } ) );
							}
							return Effect.void;
						},
						execute: ( _data, playerId, input ) =>
							Effect.gen( function* () {
								const timestamp = yield* Clock.currentTimeMillis;
								return [ TurnTransferred.make( { playerId, transferTo: input.transferTo, timestamp } ) ];
							} )
					}
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
							nextPlayer = opponents.find( pid => ( state.hands[ pid ]?.length ?? 0 ) > 0 )
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
						const teammates = getTeammates( state.teams, nextPlayer );
						const teammateWithCards = teammates.find( pid => ( state.hands[ pid ]?.length ?? 0 ) > 0 );
						if ( teammateWithCards ) {
							return Effect.succeed( teammateWithCards );
						}
						return Effect.succeed(
							context.players.find( pid => ( state.hands[ pid ]?.length ?? 0 ) > 0 ) ?? nextPlayer
						);
					}

					return Effect.succeed( nextPlayer );
				},

				endIf: () => Effect.succeed( false ),
				resolveNextPhase: () => Effect.succeed( "PLAY" ),

				botMove: ( { state, config, context } ) => {
					const view = state as unknown as FishBotView;
					const signals = detectTeammateSignals( view, config );
					const weightedBooks = suggestBooks( view, config, signals );

					const isLastMoveSuccessfulClaim = state.lastMoveType === "claim"
						&& state.claimHistory[ 0 ]?.success
						&& state.claimHistory[ 0 ]?.playerId === context.currentPlayer;

					if ( isLastMoveSuccessfulClaim ) {
						const weightedTransfers = suggestTransfers( view, config );
						if ( weightedTransfers.length > 0 ) {
							return Effect.succeed( {
								moveType: "transferTurn" as const,
								input: { transferTo: weightedTransfers[ 0 ].transferTo }
							} );
						}
						const teammates = getTeammates( state.teams, view.playerId );
						const transferTo = teammates.find( pid => ( state.cardCounts[ pid ] ?? 0 ) > 0 );
						if ( transferTo ) {
							return Effect.succeed( {
								moveType: "transferTurn" as const,
								input: { transferTo }
							} );
						}
					}

					const weightedClaims = suggestClaims( weightedBooks, view, config, signals );
					if ( weightedClaims.length > 0 ) {
						return Effect.succeed( {
							moveType: "claimBook" as const,
							input: { claim: weightedClaims[ 0 ].claim as Record<string, PlayerId> }
						} );
					}

					const weightedAsks = suggestAsks( weightedBooks, view, config, signals );
					if ( weightedAsks.length > 0 ) {
						const { playerId, cardId } = weightedAsks[ 0 ];
						return Effect.succeed( {
							moveType: "askCard" as const,
							input: { from: playerId as PlayerId, cardId: cardId as CardT }
						} );
					}

					const fallbackBook = weightedBooks[ 0 ];
					if ( fallbackBook ) {
						const cardsInBook = getCardsOfBook( fallbackBook.book, config.type );
						const claim: Record<string, PlayerId> = {};
						for ( const cardId of cardsInBook ) {
							const owners = state.cardLocations[ cardId ] ?? context.players;
							claim[ cardId ] = owners[ 0 ];
						}
						return Effect.succeed( {
							moveType: "claimBook" as const,
							input: { claim: claim as Record<string, PlayerId> }
						} );
					}

					// No available move — last resort: an empty claim keeps the engine
					// progressing (resolves to the opponents on a failed claim).
					return Effect.succeed( {
						moveType: "claimBook" as const,
						input: { claim: {} as Record<string, PlayerId> }
					} );
				}
			}
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class FishRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( FishConfig ),
	EngineRpc.makeGetState( FishSnapshot ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "createTeams", CreateTeamsInput ),
	EngineRpc.makeForMove( "askCard", AskCardInput ),
	EngineRpc.makeForMove( "claimBook", ClaimBookInput ),
	EngineRpc.makeForMove( "transferTurn", TransferTurnInput ),
	EngineRpc.makeUndo( FishSnapshot ),
	EngineRpc.makeRedo( FishSnapshot )
) {
	public static layer = FishRpcs.toLayer( {
		initialize: fish.initialize,
		getState: fish.getState,
		join: fish.join,
		addBots: fish.addBots,
		start: fish.start,
		undo: fish.undo,
		redo: fish.redo,
		createTeams: ( { playerInfo, input } ) => fish.submitMove( "createTeams", playerInfo, input ),
		askCard: ( { playerInfo, input } ) => fish.submitMove( "askCard", playerInfo, input ),
		claimBook: ( { playerInfo, input } ) => fish.submitMove( "claimBook", playerInfo, input ),
		transferTurn: ( { playerInfo, input } ) => fish.submitMove( "transferTurn", playerInfo, input )
	} );
}
