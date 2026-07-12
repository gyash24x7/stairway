// @s2h/fish/swish — Fish (Literature) as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old `AbstractGameEngine` DO). Same rules,
// re-expressed under event sourcing: moves/hooks/phase transitions EMIT domain
// events and a pure `apply` reducer folds them onto `state` (the only place
// state changes). Nondeterminism (team ids, deck shuffle/deal, timestamps) is
// produced in the deciders and CAPTURED in the emitted event payloads so replay
// is exact. The pure book/team helpers in ./utils are reused as-is.

import { Clock, Effect, Match, Schema } from "effect";
import { RpcGroup } from "effect/unstable/rpc";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { definePhasedGame } from "@s2h/swish/structure";
import { remove } from "@s2h/utils/array";
import {
	CARD_RANKS,
	type CardId,
	generateDeck,
	generateHands,
	getCardRank,
	SORTED_DECK
} from "@s2h/utils/cards";
import { generateId } from "@s2h/utils/generator";
import {
	detectTeammateSignals,
	suggestAsks,
	suggestBooks,
	suggestClaims,
	suggestTransfers
} from "./bot";
import type { FishBotView } from "./types";
import {
	getBookForCard,
	getCardsOfBook,
	getClaimedBooks,
	getOpponents,
	getTeammates
} from "./utils";

// --- Schemas ---------------------------------------------------------------

const BookType = Schema.Literals( [ "NORMAL", "CANADIAN" ] );
const Card = Schema.Literals( SORTED_DECK );
const Book = Schema.String;

const Metrics = Schema.Struct( {
	totalAsks: Schema.Number,
	cardsTaken: Schema.Number,
	cardsGiven: Schema.Number,
	totalClaims: Schema.Number,
	successfulClaims: Schema.Number
} );

const Team = Schema.Struct( {
	id: Schema.String,
	name: Schema.String,
	members: Schema.Array( PlayerId ),
	score: Schema.Number,
	booksWon: Schema.Array( Book )
} );

const PlayerInfoData = Schema.Struct( {
	teamId: Schema.String,
	metrics: Metrics
} );

const Ask = Schema.Struct( {
	success: Schema.Boolean,
	playerId: PlayerId,
	from: PlayerId,
	cardId: Card,
	timestamp: Schema.Number
} );

const Claim = Schema.Struct( {
	success: Schema.Boolean,
	playerId: PlayerId,
	book: Book,
	correctClaim: Schema.Record( Schema.String, PlayerId ),
	actualClaim: Schema.Record( Schema.String, PlayerId ),
	timestamp: Schema.Number
} );

const Transfer = Schema.Struct( {
	playerId: PlayerId,
	transferTo: PlayerId,
	timestamp: Schema.Number
} );

export const FishConfig = Schema.Struct( {
	type: BookType,
	playerCount: Schema.Number,
	teamCount: Schema.Number,
	deckType: Schema.Literals( [ 48, 52 ] ),
	books: Schema.Array( Book ),
	bookSize: Schema.Literals( [ 4, 6 ] ),
	autoStart: Schema.optional( Schema.Boolean )
} );

export const FishState = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerInfoData ),
	teams: Schema.Record( Schema.String, Team ),
	hands: Schema.Record( PlayerId, Schema.Array( Card ) ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	cardLocations: Schema.Record( Schema.String, Schema.Array( PlayerId ) ),
	lastMoveType: Schema.optional( Schema.Literals( [ "ask", "claim", "transfer" ] ) ),
	askHistory: Schema.Array( Ask ),
	claimHistory: Schema.Array( Claim ),
	transferHistory: Schema.Array( Transfer ),
	winningTeam: Schema.optional( Schema.String )
} );

// Shared view = everything except hands. Player view = own hand.
export const FishShared = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerInfoData ),
	teams: Schema.Record( Schema.String, Team ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	cardLocations: Schema.Record( Schema.String, Schema.Array( PlayerId ) ),
	lastMoveType: Schema.optional( Schema.Literals( [ "ask", "claim", "transfer" ] ) ),
	askHistory: Schema.Array( Ask ),
	claimHistory: Schema.Array( Claim ),
	transferHistory: Schema.Array( Transfer ),
	winningTeam: Schema.optional( Schema.String )
} );

export const FishPlayer = Schema.Struct( {
	playerId: PlayerId,
	hand: Schema.Array( Card )
} );

// --- Move inputs -----------------------------------------------------------

export const CreateTeamsInput = Schema.Struct( {
	teams: Schema.Record( Schema.String, Schema.Array( PlayerId ) )
} );
export const AskCardInput = Schema.Struct( {
	from: PlayerId,
	cardId: Card
} );
export const ClaimBookInput = Schema.Struct( {
	claim: Schema.Record( Schema.String, PlayerId )
} );
export const TransferTurnInput = Schema.Struct( {
	transferTo: PlayerId
} );

type FishState = typeof FishState.Type;
type CardT = typeof Card.Type;

// --- Domain events ---------------------------------------------------------
// Nondeterministic inputs (team ids, the shuffled deal, timestamps, computed
// claim resolutions) are captured in the payloads so `apply` stays pure.

const PlayerSeated = Schema.TaggedStruct( "fish/PlayerSeated", {
	playerId: PlayerId
} );

const TeamsCreated = Schema.TaggedStruct( "fish/TeamsCreated", {
	teams: Schema.Array( Schema.Struct( {
		id: Schema.String,
		name: Schema.String,
		members: Schema.Array( PlayerId )
	} ) )
} );

const HandsDealt = Schema.TaggedStruct( "fish/HandsDealt", {
	hands: Schema.Record( PlayerId, Schema.Array( Card ) ),
	cardCounts: Schema.Record( PlayerId, Schema.Number ),
	cardLocations: Schema.Record( Schema.String, Schema.Array( PlayerId ) )
} );

const CardAsked = Schema.TaggedStruct( "fish/CardAsked", {
	success: Schema.Boolean,
	playerId: PlayerId,
	from: PlayerId,
	cardId: Card,
	timestamp: Schema.Number
} );

const BookClaimed = Schema.TaggedStruct( "fish/BookClaimed", {
	success: Schema.Boolean,
	playerId: PlayerId,
	book: Book,
	winningTeamId: Schema.String,
	correctClaim: Schema.Record( Schema.String, PlayerId ),
	actualClaim: Schema.Record( Schema.String, PlayerId ),
	timestamp: Schema.Number
} );

const TurnTransferred = Schema.TaggedStruct( "fish/TurnTransferred", {
	playerId: PlayerId,
	transferTo: PlayerId,
	timestamp: Schema.Number
} );

const WinningTeamDecided = Schema.TaggedStruct( "fish/WinningTeamDecided", {
	teamId: Schema.String
} );

const FishEvent = Schema.Union( [
	PlayerSeated,
	TeamsCreated,
	HandsDealt,
	CardAsked,
	BookClaimed,
	TurnTransferred,
	WinningTeamDecided
] );
type FishEvent = typeof FishEvent.Type;

const DEFAULT_METRICS = {
	totalAsks: 0,
	cardsGiven: 0,
	cardsTaken: 0,
	totalClaims: 0,
	successfulClaims: 0
};

// --- Reducer ---------------------------------------------------------------
// The ONLY place `state` changes. Pure, synchronous — no Effect, no Random. The
// deterministic card-tracking bookkeeping that the old `execute` did inline
// lives here; nondeterministic facts are read straight from the event payload.

const applyAsk = ( state: FishState, e: typeof CardAsked.Type ): FishState => {
	const hands = { ...state.hands };
	const cardCounts = { ...state.cardCounts };
	const playerData = { ...state.playerData };
	const cardLocations = { ...state.cardLocations } as Record<CardId, PlayerId[]>;

	const asker = playerData[ e.playerId ];
	const askerData = { ...asker, metrics: { ...asker.metrics } };
	playerData[ e.playerId ] = askerData;

	if ( e.success ) {
		hands[ e.from ] = ( hands[ e.from ] ?? [] ).filter( c => c !== e.cardId );
		cardCounts[ e.from ] = ( cardCounts[ e.from ] ?? 0 ) - 1;
		const fromData = { ...playerData[ e.from ], metrics: { ...playerData[ e.from ].metrics } };
		fromData.metrics.cardsGiven++;
		playerData[ e.from ] = fromData;

		hands[ e.playerId ] = [ ...( hands[ e.playerId ] ?? [] ), e.cardId ];
		cardCounts[ e.playerId ] = ( cardCounts[ e.playerId ] ?? 0 ) + 1;
		askerData.metrics.cardsTaken++;
	}

	askerData.metrics.totalAsks++;

	const askHistory = [
		{ success: e.success, playerId: e.playerId, from: e.from, cardId: e.cardId, timestamp: e.timestamp },
		...state.askHistory
	];

	const possibleOwners = cardLocations[ e.cardId ] ?? [];
	cardLocations[ e.cardId ] = e.success
		? [ e.playerId ]
		: remove( p => p === e.from || p === e.playerId, possibleOwners );

	if ( e.success && ( cardCounts[ e.from ] ?? 0 ) <= 0 ) {
		for ( const cid of Object.keys( cardLocations ) as CardId[] ) {
			const owners = cardLocations[ cid ];
			if ( owners && owners.includes( e.from ) ) {
				cardLocations[ cid ] = owners.filter( pid => pid !== e.from );
			}
		}
	}

	return { ...state, hands, cardCounts, playerData, cardLocations, askHistory, lastMoveType: "ask" };
};

const applyClaim = ( state: FishState, e: typeof BookClaimed.Type ): FishState => {
	const allBookCards = getCardsOfBook( e.book as never, bookTypeOf( state ) );
	const hands: Record<PlayerId, CardId[]> = {};
	for ( const [ pid, hand ] of Object.entries( state.hands ) ) {
		hands[ pid as PlayerId ] = hand.filter( c => !allBookCards.includes( c ) );
	}

	const cardCounts = { ...state.cardCounts };
	const cardLocations = { ...state.cardLocations } as Record<CardId, PlayerId[]>;
	for ( const card of allBookCards ) {
		const owner = e.correctClaim[ card ];
		if ( owner ) {
			cardCounts[ owner ] = ( cardCounts[ owner ] ?? 0 ) - 1;
		}
		delete cardLocations[ card ];
	}

	const emptyPlayers = new Set(
		Object.keys( cardCounts ).filter( pid => ( cardCounts[ pid as PlayerId ] ?? 0 ) <= 0 )
	);
	if ( emptyPlayers.size > 0 ) {
		for ( const cardId of Object.keys( cardLocations ) as CardId[] ) {
			const owners = cardLocations[ cardId ];
			if ( owners ) {
				const filtered = owners.filter( pid => !emptyPlayers.has( pid ) );
				if ( filtered.length > 0 ) {
					cardLocations[ cardId ] = filtered;
				}
			}
		}
	}

	const winner = state.teams[ e.winningTeamId ];
	const teams = {
		...state.teams,
		[ e.winningTeamId ]: {
			...winner,
			booksWon: [ ...winner.booksWon, e.book ],
			score: winner.score + 1
		}
	};

	const claimer = state.playerData[ e.playerId ];
	const claimerData = { ...claimer, metrics: { ...claimer.metrics } };
	claimerData.metrics.totalClaims++;
	if ( e.success ) {
		claimerData.metrics.successfulClaims++;
	}
	const playerData = { ...state.playerData, [ e.playerId ]: claimerData };

	const claimHistory = [
		{
			success: e.success,
			playerId: e.playerId,
			book: e.book,
			correctClaim: e.correctClaim,
			actualClaim: e.actualClaim,
			timestamp: e.timestamp
		},
		...state.claimHistory
	];

	return {
		...state,
		hands,
		cardCounts,
		cardLocations,
		teams,
		playerData,
		claimHistory,
		lastMoveType: "claim"
	};
};

// The book variant is derivable from any team's booksWon or the deck; simpler to
// carry it through config at call sites. Here we infer from the presence of 7s
// in the tracked deck (Canadian removes 7s).
const bookTypeOf = ( state: FishState ): "NORMAL" | "CANADIAN" => {
	const cards = Object.keys( state.cardLocations );
	const hasSeven = cards.some( c => getCardRank( c as CardId ) === CARD_RANKS.SEVEN );
	// If the deck is fully claimed this is ambiguous, but claims resolve before
	// that point; fall back to NORMAL only when no cards remain.
	return hasSeven ? "NORMAL" : ( cards.length > 0 ? "CANADIAN" : "NORMAL" );
};

const apply = ( state: FishState, event: FishEvent ): FishState =>
	Match.value( event ).pipe(
		Match.tag( "fish/PlayerSeated", ( e ) => ( {
			...state,
			playerData: {
				...state.playerData,
				[ e.playerId ]: { teamId: "", metrics: { ...DEFAULT_METRICS } }
			}
		} ) ),
		Match.tag( "fish/TeamsCreated", ( e ) => {
			const teams = { ...state.teams };
			const playerData = { ...state.playerData };
			for ( const t of e.teams ) {
				teams[ t.id ] = { id: t.id, name: t.name, members: [ ...t.members ], score: 0, booksWon: [] };
				for ( const pid of t.members ) {
					playerData[ pid ] = { ...playerData[ pid ], teamId: t.id };
				}
			}
			return { ...state, teams, playerData };
		} ),
		Match.tag( "fish/HandsDealt", ( e ) => ( {
			...state,
			hands: { ...e.hands },
			cardCounts: { ...e.cardCounts },
			cardLocations: { ...e.cardLocations }
		} ) ),
		Match.tag( "fish/CardAsked", ( e ) => applyAsk( state, e ) ),
		Match.tag( "fish/BookClaimed", ( e ) => applyClaim( state, e ) ),
		Match.tag( "fish/TurnTransferred", ( e ) => ( {
			...state,
			lastMoveType: "transfer" as const,
			transferHistory: [
				{ playerId: e.playerId, transferTo: e.transferTo, timestamp: e.timestamp },
				...state.transferHistory
			]
		} ) ),
		Match.tag( "fish/WinningTeamDecided", ( e ) => ( { ...state, winningTeam: e.teamId } ) ),
		Match.exhaustive
	);

// --- Engine ----------------------------------------------------------------

export const fish = makeEngine(
	definePhasedGame( {
		name: "fish",
		stateSchema: FishState,
		configSchema: FishConfig,
		sharedViewSchema: FishShared,
		playerViewSchema: FishPlayer,
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
			Effect.succeed( getClaimedBooks( state as never ).length === config.books.length ),

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
							const opponents = getOpponents( state.teams as never, playerId );
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
							if ( getClaimedBooks( state as never ).includes( book ) ) {
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
							if ( getClaimedBooks( state as never ).includes( book ) ) {
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
							const teamMates = getTeammates( state.teams as never, playerId );
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
							const opponents = getOpponents( state.teams as never, lastClaim.playerId ) as PlayerId[];
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
						const teammates = getTeammates( state.teams as never, nextPlayer ) as PlayerId[];
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
					const signals = detectTeammateSignals( view, config as never );
					const weightedBooks = suggestBooks( view, config as never, signals );

					const isLastMoveSuccessfulClaim = state.lastMoveType === "claim"
						&& state.claimHistory[ 0 ]?.success
						&& state.claimHistory[ 0 ]?.playerId === context.currentPlayer;

					if ( isLastMoveSuccessfulClaim ) {
						const weightedTransfers = suggestTransfers( view, config as never );
						if ( weightedTransfers.length > 0 ) {
							return Effect.succeed( {
								moveType: "transferTurn" as const,
								input: { transferTo: weightedTransfers[ 0 ].transferTo }
							} );
						}
						const teammates = getTeammates( state.teams as never, view.playerId ) as PlayerId[];
						const transferTo = teammates.find( pid => ( state.cardCounts[ pid ] ?? 0 ) > 0 );
						if ( transferTo ) {
							return Effect.succeed( {
								moveType: "transferTurn" as const,
								input: { transferTo }
							} );
						}
					}

					const weightedClaims = suggestClaims( weightedBooks, view, config as never, signals );
					if ( weightedClaims.length > 0 ) {
						return Effect.succeed( {
							moveType: "claimBook" as const,
							input: { claim: weightedClaims[ 0 ].claim as Record<string, PlayerId> }
						} );
					}

					const weightedAsks = suggestAsks( weightedBooks, view, config as never, signals );
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

					// No available move — replay the last resort: claim the first book with
					// current best-guess owners (keeps the engine progressing).
					return Effect.succeed( {
						moveType: "claimBook" as const,
						input: { claim: {} as Record<string, PlayerId> }
					} );
				}
			}
		}
	} )
);

// Whether a player has been seated (has playerData). Seats are created lazily in
// `onJoin` bookkeeping below via the engine's PlayerJoined; here we treat any
// player present in the roster context as seated.
const playerSeated = ( state: FishState, pid: PlayerId ): boolean =>
	state.playerData[ pid ] !== undefined;

// --- RPC surface -----------------------------------------------------------

export class FishRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( FishConfig ),
	EngineRpc.makeGetState( FishShared, FishPlayer ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "createTeams", CreateTeamsInput ),
	EngineRpc.makeForMove( "askCard", AskCardInput ),
	EngineRpc.makeForMove( "claimBook", ClaimBookInput ),
	EngineRpc.makeForMove( "transferTurn", TransferTurnInput ),
	EngineRpc.makeUndo( FishShared, FishPlayer ),
	EngineRpc.makeRedo( FishShared, FishPlayer )
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
