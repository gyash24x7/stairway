// @s2h/splendor/engine — Splendor as an event-sourced swish game.
//
// The swish port of the old `AbstractGameEngine` DO. Same rules re-expressed
// under event sourcing: moves/hooks EMIT domain events and a pure `apply`
// reducer (in ./utils) folds them onto `state` (the only place state changes).
// All nondeterminism (deck shuffles, card draws, noble deal) happens in the
// deciders (`setup`/hooks/`execute`) and the concrete drawn cards are CAPTURED
// in the emitted event payloads so replay is exact.

import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { defineGame } from "@s2h/swish/structure";
import * as Effect from "effect/Effect";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import {
	CardPurchasedEvent,
	CardReservedEvent,
	type Gem,
	GameDealtEvent,
	type Noble,
	PickTokensInput,
	PlayerDataInitializedEvent,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorEvent,
	SplendorPlayerView,
	SplendorSharedView,
	SplendorSnapshot,
	SplendorState,
	type Tokens,
	TokensPickedEvent,
	WinnerDecidedEvent
} from "./schema";
import {
	apply,
	DEFAULT_TOKENS,
	discountedCost,
	findNobleVisit,
	findOpenCard,
	generateDecks,
	generateNobles,
	sumTokens
} from "./utils";

const MAX_TOKENS_IN_HAND = 10;
const MAX_RESERVED = 3;

const GEMS: ReadonlyArray<Exclude<Gem, "gold">> =
	[ "diamond", "sapphire", "emerald", "ruby", "onyx" ];
const ALL_GEMS: ReadonlyArray<Gem> = [ ...GEMS, "gold" ];

const fail = ( move: string, reason: string ) =>
	Effect.fail( new InvalidMove( { move, reason } ) );

// --- Engine ----------------------------------------------------------------

export const splendor = makeEngine(
	defineGame( {
		name: "splendor",
		stateSchema: SplendorState,
		configSchema: SplendorConfig,
		sharedViewSchema: SplendorSharedView,
		playerViewSchema: SplendorPlayerView,
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
			const someoneWon = players.some(
				id => ( state.playerData[ id ]?.points ?? 0 ) >= config.winningPoints
			);
			return Effect.succeed( roundComplete && someoneWon );
		},

		sharedView: ( { state } ) => {
			const { decks: _decks, ...rest } = state;
			return Effect.succeed( rest );
		},
		playerView: ( _data, playerId ) => Effect.succeed( { playerId } ),
		resolveNextPlayer: ( { context } ) =>
			Effect.succeed( context.players[ context.turn % context.players.length ]! ),

		hooks: {
			// The first joiner seeds their empty player data, and so on.
			onJoin: ( _data, playerId ) =>
				Effect.succeed( [ PlayerDataInitializedEvent.make( { playerId } ) ] ),

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
				const cards = {
					1: state.decks[ 1 ].slice( 0, 4 ),
					2: state.decks[ 2 ].slice( 0, 4 ),
					3: state.decks[ 3 ].slice( 0, 4 )
				};
				const decks = {
					1: state.decks[ 1 ].slice( 4 ),
					2: state.decks[ 2 ].slice( 4 ),
					3: state.decks[ 3 ].slice( 4 )
				};
				return Effect.succeed( [ GameDealtEvent.make( { tokens, nobles, cards, decks } ) ] );
			},

			onEnd: ( { state, context } ) => {
				const winner = context.players.reduce( ( best, id ) => {
					const points = state.playerData[ id ]?.points ?? 0;
					const bestPoints = state.playerData[ best ]?.points ?? 0;
					return points > bestPoints ? id : best;
				} );
				return Effect.succeed( [ WinnerDecidedEvent.make( { winner } ) ] );
			}
		},

		moves: {
			pickTokens: {
				input: PickTokensInput,
				validate: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ]!;
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
						const pickedCount = input.tokens[ typesPicked[ 0 ]! ] ?? 0;
						if ( pickedCount > 2 ) {
							return fail( "pickTokens", "You cannot pick more than 2 tokens of the same type!" );
						}
						if ( pickedCount === 2 && ( state.tokens[ typesPicked[ 0 ]! ] ?? 0 ) < 4 ) {
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
					Effect.succeed( [ TokensPickedEvent.make( {
						playerId,
						tokens: input.tokens,
						returned: input.returned
					} ) ] )
			},

			reserveCard: {
				input: ReserveCardInput,
				validate: ( { state }, playerId, input ) => {
					const player = state.playerData[ playerId ]!;
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
					const returnedToken: Gem | undefined = input.returnedToken;
					if ( returnedToken && ( player.tokens[ returnedToken ] ?? 0 ) < 1 ) {
						return fail( "reserveCard", `You do not have any ${ returnedToken } tokens to return!` );
					}
					return Effect.void;
				},
				execute: ( { state }, playerId, input ) => {
					const card = findOpenCard( input.cardId, state.cards )!;
					const replacement = state.decks[ card.level ][ 0 ] ?? null;
					return Effect.succeed( [ CardReservedEvent.make( {
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
					const player = state.playerData[ playerId ]!;
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
					const player = state.playerData[ playerId ]!;
					let card = findOpenCard( input.cardId, state.cards );
					const fromReserved = !card;
					if ( !card ) {
						card = player.reserved.find( c => c.id === input.cardId )!;
					}
					const replacement = fromReserved ? null : ( state.decks[ card.level ][ 0 ] ?? null );
					// Nobles are checked against the buyer's card set AFTER this purchase.
					const ownedAfter: ReadonlyArray<typeof card> = [ ...player.cards, card ];
					const noble: Noble | null = findNobleVisit( ownedAfter, state.nobles );
					return Effect.succeed( [ CardPurchasedEvent.make( {
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
	EngineRpc.makeGetState( SplendorSnapshot ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "pickTokens", PickTokensInput ),
	EngineRpc.makeForMove( "reserveCard", ReserveCardInput ),
	EngineRpc.makeForMove( "purchaseCard", PurchaseCardInput ),
	EngineRpc.makeUndo( SplendorSnapshot ),
	EngineRpc.makeRedo( SplendorSnapshot )
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
