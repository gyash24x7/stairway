// @s2h/splendor/swish — Splendor as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old `AbstractGameEngine` DO). Same rules
// re-expressed under event sourcing: moves/hooks EMIT domain events and a pure
// `apply` reducer folds them onto `state` (the only place state changes). All
// nondeterminism (deck shuffles, card draws, noble deal) happens in the deciders
// (`setup`/hooks/`execute`) and the concrete drawn cards are CAPTURED in the
// emitted event payloads so replay is exact.

import { Effect, Match, Schema } from "effect";
import { RpcGroup } from "effect/unstable/rpc";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { defineGame } from "@s2h/swish/structure";
import { DEFAULT_TOKENS, generateDecks, generateNobles } from "./utils";

// --- Schemas ---------------------------------------------------------------

const Gem = Schema.Literals( [ "diamond", "sapphire", "emerald", "ruby", "onyx", "gold" ] );
const GemNoGold = Schema.Literals( [ "diamond", "sapphire", "emerald", "ruby", "onyx" ] );
const CardLevel = Schema.Literals( [ 1, 2, 3 ] );

type GemType = typeof Gem.Type;
type GemNoGoldType = typeof GemNoGold.Type;

/** Full token pool: all six gem counts present. */
const Tokens = Schema.Struct( {
	diamond: Schema.Number,
	sapphire: Schema.Number,
	emerald: Schema.Number,
	ruby: Schema.Number,
	onyx: Schema.Number,
	gold: Schema.Number
} );
type Tokens = typeof Tokens.Type;

/** A development card's cost: the five non-gold gems. */
const Cost = Schema.Struct( {
	diamond: Schema.Number,
	sapphire: Schema.Number,
	emerald: Schema.Number,
	ruby: Schema.Number,
	onyx: Schema.Number
} );
type Cost = typeof Cost.Type;

const Card = Schema.Struct( {
	id: Schema.String,
	level: CardLevel,
	points: Schema.Number,
	cost: Cost,
	bonus: GemNoGold
} );
type Card = typeof Card.Type;

const Noble = Schema.Struct( {
	id: Schema.String,
	points: Schema.Number,
	cost: Cost
} );
type Noble = typeof Noble.Type;

const PlayerData = Schema.Struct( {
	tokens: Tokens,
	cards: Schema.Array( Card ),
	nobles: Schema.Array( Noble ),
	reserved: Schema.Array( Card ),
	points: Schema.Number
} );

const CardsByLevel = Schema.Struct( {
	1: Schema.Array( Card ),
	2: Schema.Array( Card ),
	3: Schema.Array( Card )
} );
type CardsByLevel = typeof CardsByLevel.Type;

export const SplendorConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.optional( Schema.Boolean ),
	winningPoints: Schema.Number
} );

export const SplendorState = Schema.Struct( {
	tokens: Tokens,
	cards: CardsByLevel,
	nobles: Schema.Array( Noble ),
	decks: CardsByLevel,
	playerData: Schema.Record( PlayerId, PlayerData ),
	winner: Schema.optional( PlayerId )
} );
type SplendorState = typeof SplendorState.Type;

/** Shared view hides the face-down decks. */
export const SplendorShared = Schema.Struct( {
	tokens: Tokens,
	cards: CardsByLevel,
	nobles: Schema.Array( Noble ),
	playerData: Schema.Record( PlayerId, PlayerData ),
	winner: Schema.optional( PlayerId )
} );

export const SplendorPlayer = Schema.Struct( { playerId: PlayerId } );

// A `Partial<Tokens>` on the wire: only the picked/paid/returned gems present.
const PartialTokens = Schema.Record( Gem, Schema.Number );
type PartialTokens = typeof PartialTokens.Type;

export const PickTokensInput = Schema.Struct( {
	tokens: PartialTokens,
	returned: Schema.optional( PartialTokens )
} );
export const ReserveCardInput = Schema.Struct( {
	cardId: Schema.String,
	withGold: Schema.Boolean,
	returnedToken: Schema.optional( Gem )
} );
export const PurchaseCardInput = Schema.Struct( {
	cardId: Schema.String,
	payment: PartialTokens
} );

const MAX_TOKENS_IN_HAND = 10;
const MAX_RESERVED = 3;

// --- Domain events + reducer -----------------------------------------------

const PlayerDataInitialized = Schema.TaggedStruct( "splendor/PlayerDataInitialized", {
	playerId: PlayerId
} );
// The nondeterministic deal captured at start: token pool, dealt nobles, the
// four open cards per level, and the remaining decks after dealing.
const GameDealt = Schema.TaggedStruct( "splendor/GameDealt", {
	tokens: Tokens,
	nobles: Schema.Array( Noble ),
	cards: CardsByLevel,
	decks: CardsByLevel
} );
const TokensPicked = Schema.TaggedStruct( "splendor/TokensPicked", {
	playerId: PlayerId,
	tokens: PartialTokens,
	returned: Schema.optional( PartialTokens )
} );
// `replacement` is the concrete card drawn from the deck to refill the open
// slot (or null when the deck is exhausted) — captured so replay is exact.
const CardReserved = Schema.TaggedStruct( "splendor/CardReserved", {
	playerId: PlayerId,
	card: Card,
	replacement: Schema.NullOr( Card ),
	withGold: Schema.Boolean,
	returnedToken: Schema.optional( Gem )
} );
const CardPurchased = Schema.TaggedStruct( "splendor/CardPurchased", {
	playerId: PlayerId,
	card: Card,
	fromReserved: Schema.Boolean,
	replacement: Schema.NullOr( Card ),
	payment: PartialTokens,
	noble: Schema.NullOr( Noble )
} );
const WinnerDecided = Schema.TaggedStruct( "splendor/WinnerDecided", { winner: PlayerId } );

const SplendorEvent = Schema.Union( [
	PlayerDataInitialized,
	GameDealt,
	TokensPicked,
	CardReserved,
	CardPurchased,
	WinnerDecided
] );
type SplendorEvent = typeof SplendorEvent.Type;

const GEMS: ReadonlyArray<GemNoGoldType> = [ "diamond", "sapphire", "emerald", "ruby", "onyx" ];
const ALL_GEMS: ReadonlyArray<GemType> = [ ...GEMS, "gold" ];

/** Remove one card by id from a level's deck (pure). */
const dropFromDeck = ( deck: ReadonlyArray<Card>, card: Card | null ): ReadonlyArray<Card> =>
	card === null ? deck : deck.filter( c => c.id !== card.id );

/** Replace an open slot (by removed card id) with `replacement` (or drop it). */
const refillOpen = (
	open: ReadonlyArray<Card>,
	removed: Card,
	replacement: Card | null
): ReadonlyArray<Card> => {
	const idx = open.findIndex( c => c.id === removed.id );
	if ( idx < 0 ) {
		return open;
	}
	const next = [ ...open ];
	if ( replacement === null ) {
		next.splice( idx, 1 );
	} else {
		next[ idx ] = replacement;
	}
	return next;
};

/** Pure reducer — the ONLY place `state` changes. No Effect, no Random. */
const apply = ( state: SplendorState, event: SplendorEvent ): SplendorState =>
	Match.value( event ).pipe(
		Match.tag( "splendor/PlayerDataInitialized", ( e ) => ( {
			...state,
			playerData: {
				...state.playerData,
				[ e.playerId ]: {
					tokens: { ...DEFAULT_TOKENS },
					cards: [],
					nobles: [],
					reserved: [],
					points: 0
				}
			}
		} ) ),
		Match.tag( "splendor/GameDealt", ( e ) => ( {
			...state,
			tokens: e.tokens,
			nobles: e.nobles,
			cards: e.cards,
			decks: e.decks
		} ) ),
		Match.tag( "splendor/TokensPicked", ( e ) => {
			const player = state.playerData[ e.playerId ];
			const tokens = { ...state.tokens };
			const playerTokens = { ...player.tokens };
			for ( const gem of ALL_GEMS ) {
				const take = e.tokens[ gem ] ?? 0;
				if ( take > 0 ) {
					playerTokens[ gem ] += take;
					tokens[ gem ] -= take;
				}
			}
			if ( e.returned ) {
				for ( const gem of ALL_GEMS ) {
					const ret = e.returned[ gem ] ?? 0;
					if ( ret > 0 ) {
						playerTokens[ gem ] -= ret;
						tokens[ gem ] += ret;
					}
				}
			}
			return {
				...state,
				tokens,
				playerData: { ...state.playerData, [ e.playerId ]: { ...player, tokens: playerTokens } }
			};
		} ),
		Match.tag( "splendor/CardReserved", ( e ) => {
			const player = state.playerData[ e.playerId ];
			const level = e.card.level;
			const tokens = { ...state.tokens };
			const playerTokens = { ...player.tokens };
			if ( e.withGold ) {
				playerTokens.gold += 1;
				tokens.gold -= 1;
			}
			if ( e.returnedToken ) {
				playerTokens[ e.returnedToken ] -= 1;
				tokens[ e.returnedToken ] += 1;
			}
			return {
				...state,
				tokens,
				cards: { ...state.cards, [ level ]: refillOpen( state.cards[ level ], e.card, e.replacement ) },
				decks: { ...state.decks, [ level ]: dropFromDeck( state.decks[ level ], e.replacement ) },
				playerData: {
					...state.playerData,
					[ e.playerId ]: { ...player, tokens: playerTokens, reserved: [ ...player.reserved, e.card ] }
				}
			};
		} ),
		Match.tag( "splendor/CardPurchased", ( e ) => {
			const player = state.playerData[ e.playerId ];
			const level = e.card.level;
			const tokens = { ...state.tokens };
			const playerTokens = { ...player.tokens };
			for ( const gem of ALL_GEMS ) {
				const pay = e.payment[ gem ] ?? 0;
				if ( pay > 0 ) {
					playerTokens[ gem ] -= pay;
					tokens[ gem ] += pay;
				}
			}
			const reserved = e.fromReserved
				? player.reserved.filter( c => c.id !== e.card.id )
				: player.reserved;
			const cards = e.fromReserved
				? state.cards
				: { ...state.cards, [ level ]: refillOpen( state.cards[ level ], e.card, e.replacement ) };
			const decks = e.fromReserved
				? state.decks
				: { ...state.decks, [ level ]: dropFromDeck( state.decks[ level ], e.replacement ) };
			const nobles = e.noble ? state.nobles.filter( n => n.id !== e.noble!.id ) : state.nobles;
			const playerNobles = e.noble ? [ ...player.nobles, e.noble ] : player.nobles;
			const points = player.points + e.card.points + ( e.noble ? e.noble.points : 0 );
			return {
				...state,
				tokens,
				cards,
				decks,
				nobles,
				playerData: {
					...state.playerData,
					[ e.playerId ]: {
						...player,
						tokens: playerTokens,
						cards: [ ...player.cards, e.card ],
						reserved,
						nobles: playerNobles,
						points
					}
				}
			};
		} ),
		Match.tag( "splendor/WinnerDecided", ( e ) => ( { ...state, winner: e.winner } ) ),
		Match.exhaustive
	);

// --- Pure per-move helpers (decider-side) ----------------------------------

/** Sum every value of a (partial) token map. */
const sumTokens = ( t: PartialTokens | Tokens ): number =>
	Object.values( t ).reduce( ( acc, v ) => acc + ( v ?? 0 ), 0 );

// A locally-mutable cost map (schema `Cost.Type` is deeply readonly).
type MutableCost = Record<GemNoGoldType, number>;

/** Find an open card by id across all three levels (readonly-safe). */
const findOpenCard = ( cardId: string, cards: CardsByLevel ): Card | undefined => {
	for ( const level of [ 1, 2, 3 ] as const ) {
		const card = cards[ level ].find( c => c.id === cardId );
		if ( card ) {
			return card;
		}
	}
	return undefined;
};

/** Discounted cost of a card given the buyer's owned bonus cards. */
const discountedCost = ( card: Card, owned: ReadonlyArray<Card> ): MutableCost => {
	const result: MutableCost = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
	for ( const gem of GEMS ) {
		const discount = owned.filter( c => c.bonus === gem ).length;
		result[ gem ] = Math.max( 0, card.cost[ gem ] - discount );
	}
	return result;
};

/** First noble whose gem requirements the player's owned cards satisfy. */
const findNobleVisit = ( owned: ReadonlyArray<Card>, nobles: ReadonlyArray<Noble> ): Noble | null => {
	for ( const noble of nobles ) {
		const qualifies = GEMS.every( gem =>
			owned.filter( c => c.bonus === gem ).length >= noble.cost[ gem ] );
		if ( qualifies ) {
			return noble;
		}
	}
	return null;
};

const fail = ( move: string, reason: string ) =>
	Effect.fail( new InvalidMove( { move, reason } ) );

// --- Engine ----------------------------------------------------------------

export const splendor = makeEngine(
	defineGame( {
		name: "splendor",
		stateSchema: SplendorState,
		configSchema: SplendorConfig,
		sharedViewSchema: SplendorShared,
		playerViewSchema: SplendorPlayer,
		eventSchema: SplendorEvent,
		apply,

		setup: () => Effect.succeed( {
			tokens: { ...DEFAULT_TOKENS },
			cards: { 1: [], 2: [], 3: [] },
			nobles: [],
			decks: generateDecks(),
			playerData: {}
		} ),

		// Winner is decided once a full round completes AND someone met the
		// winning-points threshold (same as the old engine's endIf).
		endIf: ( { state, config, context } ) => {
			const { players, turn } = context;
			const roundComplete = turn > 0 && turn % players.length === 0;
			const someoneWon = players.some( id => ( state.playerData[ id ]?.points ?? 0 ) >= config.winningPoints );
			return Effect.succeed( roundComplete && someoneWon );
		},

		sharedView: ( { state } ) => {
			const { decks: _decks, ...rest } = state;
			return Effect.succeed( rest );
		},
		playerView: ( _data, playerId ) => Effect.succeed( { playerId } ),
		resolveNextPlayer: ( { context } ) =>
			Effect.succeed( context.players[ context.turn % context.players.length ] ),

		hooks: {
			// The first joiner seeds their empty player data, and so on.
			onJoin: ( _data, playerId ) =>
				Effect.succeed( [ PlayerDataInitialized.make( { playerId } ) ] ),

			// Deal the board: token pool sized by player count, nobles, and four
			// open cards per level drawn off the (already shuffled) decks. Capture
			// the concrete draw so replay is exact.
			onStart: ( { state } ) => {
				const playerCount = Object.keys( state.playerData ).length;
				const tokenCount = playerCount === 4 ? 7 : 5;
				const tokens: Tokens = {
					diamond: tokenCount,
					sapphire: tokenCount,
					emerald: tokenCount,
					ruby: tokenCount,
					onyx: tokenCount,
					gold: 5
				};
				const nobles = generateNobles( playerCount );
				const cards: CardsByLevel = {
					1: state.decks[ 1 ].slice( 0, 4 ),
					2: state.decks[ 2 ].slice( 0, 4 ),
					3: state.decks[ 3 ].slice( 0, 4 )
				};
				const decks: CardsByLevel = {
					1: state.decks[ 1 ].slice( 4 ),
					2: state.decks[ 2 ].slice( 4 ),
					3: state.decks[ 3 ].slice( 4 )
				};
				return Effect.succeed( [ GameDealt.make( { tokens, nobles, cards, decks } ) ] );
			},

			onEnd: ( { state, context } ) => {
				const winner = context.players.reduce( ( best, id ) => {
					const points = state.playerData[ id ]?.points ?? 0;
					const bestPoints = state.playerData[ best ]?.points ?? 0;
					return points > bestPoints ? id : best;
				} );
				return Effect.succeed( [ WinnerDecided.make( { winner } ) ] );
			}
		},

		moves: {
			pickTokens: {
				input: PickTokensInput,
				validate: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ];
					if ( "gold" in input.tokens ) {
						return fail( "pickTokens", "Gold tokens cannot be picked directly!" );
					}
					for ( const gem of ALL_GEMS ) {
						const take = input.tokens[ gem ] ?? 0;
						if ( take > state.tokens[ gem ] ) {
							return fail( "pickTokens", `Not enough ${ gem } tokens available!` );
						}
					}

					const availableTypes = ALL_GEMS.filter( gem => state.tokens[ gem ] > 0 );
					const typesPicked = ALL_GEMS.filter( gem => ( input.tokens[ gem ] ?? 0 ) > 0 );

					if ( typesPicked.length === 1 ) {
						const pickedCount = input.tokens[ typesPicked[ 0 ] ] ?? 0;
						if ( pickedCount > 2 ) {
							return fail( "pickTokens", "You cannot pick more than 2 tokens of the same type!" );
						}
						if ( pickedCount === 2 && ( state.tokens[ typesPicked[ 0 ] ] ?? 0 ) < 4 ) {
							return fail(
								"pickTokens",
								"You cannot pick 2 tokens of the same type when less than 4 are available!"
							);
						}
					} else if ( typesPicked.length === 2 ) {
						if ( availableTypes.length < 2 ) {
							return fail(
								"pickTokens",
								"You cannot pick 2 different types when less than 2 types are available!"
							);
						}
						if ( typesPicked.some( gem => ( input.tokens[ gem ] ?? 0 ) > 1 ) ) {
							return fail(
								"pickTokens",
								"You cannot pick more than 1 token of a type when picking 2 different types!"
							);
						}
					} else if ( typesPicked.length === 3 ) {
						if ( availableTypes.length < 3 ) {
							return fail(
								"pickTokens",
								"You cannot pick 3 different types when less than 3 types are available!"
							);
						}
						if ( typesPicked.some( gem => ( input.tokens[ gem ] ?? 0 ) > 1 ) ) {
							return fail(
								"pickTokens",
								"You cannot pick more than 1 token of a type when picking 3 different types!"
							);
						}
					} else {
						return fail( "pickTokens", "Invalid number of token types picked!" );
					}

					const totalBefore = sumTokens( player.tokens );
					const pickedTokens = sumTokens( input.tokens );
					const totalAfterPick = totalBefore + pickedTokens;

					if ( totalAfterPick <= MAX_TOKENS_IN_HAND ) {
						if ( input.returned && sumTokens( input.returned ) > 0 ) {
							return fail(
								"pickTokens",
								"You cannot return tokens when your total after pick does not exceed 10!"
							);
						}
						return Effect.void;
					}

					const extraToReturn = totalAfterPick - MAX_TOKENS_IN_HAND;
					const returnedTokens = sumTokens( input.returned ?? {} );
					if ( returnedTokens !== extraToReturn ) {
						return fail(
							"pickTokens",
							`You must return exactly ${ extraToReturn } token(s) when you exceed the limit!`
						);
					}
					for ( const gem of ALL_GEMS ) {
						const ret = input.returned?.[ gem ] ?? 0;
						const availableAfterPick = player.tokens[ gem ] + ( input.tokens[ gem ] ?? 0 );
						if ( ret > availableAfterPick ) {
							return fail( "pickTokens", `You do not have enough ${ gem } tokens to return!` );
						}
					}
					return Effect.void;
				},
				execute: ( _data, playerId, input ) =>
					Effect.succeed( [ TokensPicked.make( {
						playerId,
						tokens: input.tokens,
						returned: input.returned
					} ) ] )
			},

			reserveCard: {
				input: ReserveCardInput,
				validate: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ];
					if ( player.reserved.length >= MAX_RESERVED ) {
						return fail( "reserveCard", "You cannot reserve more than 3 cards!" );
					}
					if ( !findOpenCard( input.cardId, state.cards ) ) {
						return fail( "reserveCard", "Card not found!" );
					}
					if ( input.withGold && state.tokens.gold < 1 ) {
						return fail( "reserveCard", "Not enough gold tokens available!" );
					}
					if ( input.withGold ) {
						const totalTokens = sumTokens( player.tokens );
						if ( totalTokens + 1 > 10 && !input.returnedToken ) {
							return fail(
								"reserveCard",
								"You must return a token when reserving with gold exceeds your token limit!"
							);
						}
						if ( totalTokens + 1 <= 10 && input.returnedToken ) {
							return fail(
								"reserveCard",
								"You cannot return a token when reserving with gold does not exceed your token limit!"
							);
						}
					}
					const returnedToken: GemType | undefined = input.returnedToken;
					if ( returnedToken && ( player.tokens[ returnedToken ] ?? 0 ) < 1 ) {
						return fail( "reserveCard", `You do not have any ${ returnedToken } tokens to return!` );
					}
					return Effect.void;
				},
				execute: ( { state }, playerId, input ) => {
					const card = findOpenCard( input.cardId, state.cards )!;
					const replacement = state.decks[ card.level ][ 0 ] ?? null;
					return Effect.succeed( [ CardReserved.make( {
						playerId,
						card,
						replacement,
						withGold: input.withGold,
						returnedToken: input.returnedToken
					} ) ] );
				}
			},

			purchaseCard: {
				input: PurchaseCardInput,
				validate: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ];
					let card = findOpenCard( input.cardId, state.cards );
					if ( !card ) {
						card = player.reserved.find( c => c.id === input.cardId );
						if ( !card ) {
							return fail( "purchaseCard", "Card not found!" );
						}
					}
					const totalCost = discountedCost( card, player.cards );
					let goldNeeded = 0;
					for ( const gem of GEMS ) {
						if ( ( input.payment[ gem ] ?? 0 ) > totalCost[ gem ] ) {
							return fail( "purchaseCard", "Overpayment is not allowed!" );
						}
						const diff = totalCost[ gem ] - ( input.payment[ gem ] ?? 0 );
						if ( diff > 0 ) {
							goldNeeded += diff;
						}
					}
					if ( ( input.payment.gold ?? 0 ) < goldNeeded ) {
						return fail( "purchaseCard", "Not enough gold tokens provided!" );
					}
					if ( ( input.payment.gold ?? 0 ) > goldNeeded ) {
						return fail( "purchaseCard", "Overpayment is not allowed!" );
					}
					for ( const gem of ALL_GEMS ) {
						if ( ( input.payment[ gem ] ?? 0 ) > player.tokens[ gem ] ) {
							return fail( "purchaseCard", `You do not have enough ${ gem } tokens!` );
						}
					}
					return Effect.void;
				},
				execute: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ];
					let card = findOpenCard( input.cardId, state.cards );
					const fromReserved = !card;
					if ( !card ) {
						card = player.reserved.find( c => c.id === input.cardId )!;
					}
					const replacement = fromReserved ? null : ( state.decks[ card.level ][ 0 ] ?? null );
					// Nobles are checked against the buyer's card set AFTER this purchase.
					const ownedAfter = [ ...player.cards, card ];
					const noble = findNobleVisit( ownedAfter, state.nobles );
					return Effect.succeed( [ CardPurchased.make( {
						playerId,
						card,
						fromReserved,
						replacement,
						payment: input.payment,
						noble
					} ) ] );
				}
			}
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class SplendorRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( SplendorConfig ),
	EngineRpc.makeGetState( SplendorShared, SplendorPlayer ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "pickTokens", PickTokensInput ),
	EngineRpc.makeForMove( "reserveCard", ReserveCardInput ),
	EngineRpc.makeForMove( "purchaseCard", PurchaseCardInput ),
	EngineRpc.makeUndo( SplendorShared, SplendorPlayer ),
	EngineRpc.makeRedo( SplendorShared, SplendorPlayer )
) {
	public static layer = SplendorRpcs.toLayer( {
		initialize: splendor.initialize,
		getState: splendor.getState,
		join: splendor.join,
		addBots: splendor.addBots,
		start: splendor.start,
		undo: splendor.undo,
		redo: splendor.redo,
		pickTokens: ( { playerInfo, input } ) => splendor.submitMove( "pickTokens", playerInfo, input ),
		reserveCard: ( { playerInfo, input } ) => splendor.submitMove( "reserveCard", playerInfo, input ),
		purchaseCard: ( { playerInfo, input } ) => splendor.submitMove( "purchaseCard", playerInfo, input )
	} );
}
