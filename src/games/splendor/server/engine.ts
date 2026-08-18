import { decideMove } from "@/games/splendor/server/bot.ts";
import {
	apply,
	findOpenCard,
	findReservedCard,
	generateDecks,
	generateNobles,
	standingsFor
} from "@/games/splendor/server/utils.ts";
import {
	CardPurchasedEvent,
	CardReservedEvent,
	ClaimNobleInput,
	GameDealtEvent,
	NobleVisitedEvent,
	PassInput,
	PickTokensInput,
	PlayerDataInitializedEvent,
	PurchaseCardInput,
	ReserveCardInput,
	SPLENDOR_GOLD_SUPPLY,
	SPLENDOR_MAX_RESERVED,
	SPLENDOR_MAX_TOKENS,
	SPLENDOR_NOBLE_TIMEOUT_MILLIS,
	SPLENDOR_NOBLE_VISIT,
	SPLENDOR_OPEN_CARDS,
	SPLENDOR_TOKEN_SUPPLY,
	SplendorConfig,
	SplendorEvent,
	SplendorState,
	SplendorView,
	TokensPickedEvent
} from "@/games/splendor/shared/schema.ts";
import {
	ALL_GEMS,
	DEFAULT_TOKENS,
	GEMS,
	hasLegalMove,
	isValidPayment,
	qualifyingNobles,
	sumTokens
} from "@/games/splendor/shared/utils.ts";
import { makeEngine } from "@/swish/server/engine.ts";
import { playerIdFor } from "@/swish/server/utils.ts";
import { InteractionFrame, InteractionOpened, InvalidMove } from "@/swish/shared/schema.ts";

import type { Noble, Tokens } from "@/games/splendor/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

const fail = ( move: string, reason: string ) => new InvalidMove( { move, reason } );

/**
 * The frame a purchase opens when the buyer has a choice of nobles. It names
 * only the buyer as a responder — nobody else has a say — and carries the ids
 * they are choosing between so a client can offer exactly those.
 *
 * @param playerId The buyer.
 * @param nobles The nobles now willing to visit them.
 */
const nobleFrame = ( playerId: PlayerId, nobles: ReadonlyArray<Noble> ) =>
	InteractionOpened.make( {
		frame: InteractionFrame.make( {
			kind: SPLENDOR_NOBLE_VISIT,
			initiator: playerId,
			responders: [ playerId ],
			mode: "sequential",
			responses: {},
			payload: nobles.map( noble => noble.id )
		} )
	} );

// --- Engine ----------------------------------------------------------------

export const splendor = makeEngine( {
	name: "splendor",
	schemas: {
		state: SplendorState,
		config: SplendorConfig,
		events: SplendorEvent,
		view: SplendorView,
		moves: {
			pickTokens: PickTokensInput,
			reserveCard: ReserveCardInput,
			purchaseCard: PurchaseCardInput,
			pass: PassInput,
			claimNoble: ClaimNobleInput
		}
	},
	apply,

	// The decks are the whole of `setup`: the table is empty at `initialize`, so
	// the bank, the nobles and the face-up rows all wait for `onStart`, which is
	// the first point the seat count is known.
	setup: ( _config, rng ) => SplendorState.make( {
		tokens: { ...DEFAULT_TOKENS },
		cards: { 1: [], 2: [], 3: [] },
		nobles: [],
		decks: generateDecks( rng( "decks" ).next ),
		playerData: {}
	} ),

	/**
	 * Splendor ends on a round boundary, not the moment somebody crosses the line:
	 * whoever reaches the winning score triggers the last round, and every seat
	 * that has not yet played in it still gets its turn.
	 *
	 * `turn` is incremented before this runs, so a multiple of the roster size is
	 * exactly "everyone has now had the same number of turns". That equivalence
	 * relies on the default round-robin, which skips a seat that has gone
	 * inactive — a table that loses a seat mid-game ends on a boundary that is a
	 * turn or two late rather than never.
	 *
	 * A table where nobody can move ends too, wherever it happens to be. Passing
	 * changes nothing, so a position everyone has to pass in would repeat forever
	 * — one commit per pass, on a log that never stops growing. Ending it there
	 * and ranking the seats as they stand is the only outcome that terminates.
	 */
	endIf: ( { state, config, context } ) => {
		const { players, turn } = context;
		if ( players.length === 0 ) {
			return false;
		}

		const roundComplete = turn > 0 && turn % players.length === 0;
		const someoneWon = players.some(
			id => ( state.playerData[ id ]?.points ?? 0 ) >= config.winningPoints
		);

		if ( roundComplete && someoneWon ) {
			return true;
		}

		// One gem left in the bank is a legal take for every seat, so nobody is
		// stuck and there is nothing to ask per seat. Checking it first keeps the
		// deadlock test free on all but the last few turns of a drained table.
		if ( GEMS.some( gem => state.tokens[ gem ] > 0 ) ) {
			return false;
		}

		return players.every( id => {
			const seat = state.playerData[ id ];
			const status = context.seats[ id ] ?? "active";
			return status !== "active" || !seat || !hasLegalMove( state, seat );
		} );
	},

	/**
	 * Final placement by prestige, with the rulebook's fewest-development-cards
	 * tie-break. Seats level on both share a rank and leave `winner` unset, which
	 * is the rules' own answer to a dead heat rather than a further tie-break.
	 *
	 * This is the only place a game's verdict is recorded. The engine stamps what
	 * comes back onto the record, and every `GameView` carries it.
	 */
	resolveResults: ( { state, context } ) => standingsFor( context.players, state.playerData ),

	/**
	 * One shape for every audience. The only thing a Splendor table hides is the
	 * order of its three decks, so those become counts and everything else — the
	 * bank, the rows, the nobles, every seat's holdings — goes out as it stands.
	 */
	view: ( { state }, audience ) => SplendorView.make( {
		...state,
		deckCounts: {
			1: state.decks[ 1 ].length,
			2: state.decks[ 2 ].length,
			3: state.decks[ 3 ].length
		},
		playerId: playerIdFor( audience )
	} ),

	hooks: {
		onJoin: ( _data, playerId ) => [ PlayerDataInitializedEvent.make( { playerId } ) ],

		onStart: ( { state, config }, rng ) => {
			const playerCount = config.playerCount;
			const supply = SPLENDOR_TOKEN_SUPPLY[ playerCount ];
			const tokens: Tokens = {
				diamond: supply,
				sapphire: supply,
				emerald: supply,
				ruby: supply,
				onyx: supply,
				gold: SPLENDOR_GOLD_SUPPLY
			};

			const nobles = generateNobles( playerCount, rng( "nobles" ).next );
			const cards = {
				1: state.decks[ 1 ].slice( 0, SPLENDOR_OPEN_CARDS ),
				2: state.decks[ 2 ].slice( 0, SPLENDOR_OPEN_CARDS ),
				3: state.decks[ 3 ].slice( 0, SPLENDOR_OPEN_CARDS )
			};
			const decks = {
				1: state.decks[ 1 ].slice( SPLENDOR_OPEN_CARDS ),
				2: state.decks[ 2 ].slice( SPLENDOR_OPEN_CARDS ),
				3: state.decks[ 3 ].slice( SPLENDOR_OPEN_CARDS )
			};

			return [ GameDealtEvent.make( { tokens, nobles, cards, decks } ) ];
		}
	},

	moves: {
		pickTokens: {
			validate: ( { state }, playerId, input ) => {
				const player = state.playerData[ playerId ]!;

				if ( ( input.tokens.gold ?? 0 ) > 0 ) {
					return fail( "pickTokens", "Gold is only taken by reserving a card!" );
				}

				for ( const gem of GEMS ) {
					if ( ( input.tokens[ gem ] ?? 0 ) > state.tokens[ gem ] ) {
						return fail( "pickTokens", `The bank does not hold that many ${ gem } tokens!` );
					}
				}

				const availableTypes = GEMS.filter( gem => state.tokens[ gem ] > 0 );
				const picked = GEMS.filter( gem => ( input.tokens[ gem ] ?? 0 ) > 0 );
				const taken = sumTokens( input.tokens );

				if ( picked.length === 0 ) {
					return fail( "pickTokens", "You must take at least one token!" );
				}

				if ( picked.length === 1 && taken === 2 ) {
					// Two of a kind, which the rules only allow off a healthy pile.
					if ( state.tokens[ picked[ 0 ]! ] < 4 ) {
						return fail(
							"pickTokens",
							"You cannot take two of a kind unless the bank holds at least four!"
						);
					}
				} else if ( taken === picked.length ) {
					// One each. Three different, or every type left when there are fewer.
					const required = Math.min( 3, availableTypes.length );

					// A seat near the limit may stop short rather than take the full
					// three and hand the excess straight back on the same move. The
					// printed rules only ever produce the second, and it is still legal
					// here — this widens the window rather than moving it, so "take
					// three and discard two" and "just take the one that fits" are both
					// accepted at nine tokens, and nothing changes for a seat with room.
					const room = Math.max( 0, SPLENDOR_MAX_TOKENS - sumTokens( player.tokens ) );
					const minimum = Math.max( 1, Math.min( required, room ) );

					if ( picked.length < minimum || picked.length > required ) {
						return fail(
							"pickTokens",
							minimum === required
								? `You must take ${ required } different gem(s) — that is what is left!`
								: `Take between ${ minimum } and ${ required } different gems!`
						);
					}
				} else {
					return fail( "pickTokens", "Take three different gems, or two of the same!" );
				}

				const returned = input.returned ?? {};
				const excess = Math.max( 0, sumTokens( player.tokens ) + taken - SPLENDOR_MAX_TOKENS );

				if ( sumTokens( returned ) !== excess ) {
					return fail(
						"pickTokens",
						excess === 0
							? "You are not over the token limit, so nothing goes back!"
							: `You must put exactly ${ excess } token(s) back!`
					);
				}

				for ( const gem of ALL_GEMS ) {
					const back = returned[ gem ] ?? 0;
					if ( back > player.tokens[ gem ] + ( input.tokens[ gem ] ?? 0 ) ) {
						return fail( "pickTokens", `You do not hold that many ${ gem } tokens to put back!` );
					}
				}

				return undefined;
			},

			execute: ( _data, playerId, input ) => [
				TokensPickedEvent.make( {
					playerId,
					tokens: input.tokens,
					returned: input.returned
				} )
			]
		},

		reserveCard: {
			validate: ( { state }, playerId, input ) => {
				const player = state.playerData[ playerId ]!;

				if ( player.reserved.length >= SPLENDOR_MAX_RESERVED ) {
					return fail(
						"reserveCard",
						`You cannot hold more than ${ SPLENDOR_MAX_RESERVED } reserved cards!`
					);
				}

				if ( !findOpenCard( input.cardId, state.cards ) ) {
					return fail( "reserveCard", "That card is not on the board!" );
				}

				if ( input.withGold && state.tokens.gold < 1 ) {
					return fail( "reserveCard", "The bank has no gold left!" );
				}

				const gained = input.withGold ? 1 : 0;
				const over = sumTokens( player.tokens ) + gained > SPLENDOR_MAX_TOKENS;

				if ( over && !input.returnedToken ) {
					return fail( "reserveCard", "Taking the gold puts you over the limit — put one back!" );
				}

				if ( !over && input.returnedToken ) {
					return fail( "reserveCard", "You are not over the token limit, so nothing goes back!" );
				}

				if ( input.returnedToken ) {
					// The gold arrives before the discard, so it is a legal thing to hand back.
					const held = player.tokens[ input.returnedToken ]
						+ ( input.returnedToken === "gold" ? gained : 0 );

					if ( held < 1 ) {
						return fail(
							"reserveCard",
							`You have no ${ input.returnedToken } tokens to put back!`
						);
					}
				}

				return undefined;
			},

			execute: ( { state }, playerId, input ) => {
				const card = findOpenCard( input.cardId, state.cards )!;
				const replacement = state.decks[ card.level ][ 0 ] ?? null;

				return [
					CardReservedEvent.make( {
						playerId,
						card,
						replacement,
						withGold: input.withGold,
						returnedToken: input.returnedToken
					} )
				];
			}
		},

		purchaseCard: {
			validate: ( { state }, playerId, input ) => {
				const player = state.playerData[ playerId ]!;
				const card = findOpenCard( input.cardId, state.cards )
					?? findReservedCard( input.cardId, player );

				if ( !card ) {
					return fail( "purchaseCard", "That card is neither on the board nor in your reserve!" );
				}

				if ( !isValidPayment( card, input.payment, player.cards ) ) {
					return fail(
						"purchaseCard",
						"The payment must cover the discounted cost exactly, with gold for the rest!"
					);
				}

				for ( const gem of ALL_GEMS ) {
					if ( ( input.payment[ gem ] ?? 0 ) > player.tokens[ gem ] ) {
						return fail( "purchaseCard", `You do not hold that many ${ gem } tokens!` );
					}
				}

				return undefined;
			},

			execute: ( { state }, playerId, input ) => {
				const player = state.playerData[ playerId ]!;
				const open = findOpenCard( input.cardId, state.cards );
				const card = open ?? findReservedCard( input.cardId, player )!;
				const fromReserved = !open;
				const replacement = fromReserved ? null : ( state.decks[ card.level ][ 0 ] ?? null );

				const purchase = CardPurchasedEvent.make( {
					playerId,
					card,
					fromReserved,
					replacement,
					payment: input.payment
				} );

				// A noble comes on the strength of the card just bought, so the visit is
				// worked out against the buyer's holdings *with* it. One noble settles
				// itself; two or more is the player's choice, and the frame is what asks.
				const willing = qualifyingNobles( [ ...player.cards, card ], state.nobles );

				if ( willing.length === 0 ) {
					return [ purchase ];
				}

				return willing.length === 1
					? [ purchase, NobleVisitedEvent.make( { playerId, noble: willing[ 0 ]! } ) ]
					: [ purchase, nobleFrame( playerId, willing ) ];
			}
		},

		pass: {
			/**
			 * Giving up a turn, which the rules only allow when there is nothing to
			 * give up: an empty gem bank, no room in reserve or nothing on the board
			 * to put there, and not a card on the table or in hand the seat can pay
			 * for. Anything short of that is a turn the player has to take.
			 */
			validate: ( { state }, playerId ) =>
				hasLegalMove( state, state.playerData[ playerId ]! )
					? fail( "pass", "You still have a move to make!" )
					: undefined,

			// Nothing about the game changes, only whose turn it is — and the engine's
			// turn tail is what does that, so there is no event to emit.
			execute: () => []
		},

		claimNoble: {
			/**
			 * Only ever reachable as a response. The engine routes a move played while
			 * a frame is open to that frame, so this branch is what a caller sees when
			 * they play it with nothing pending.
			 */
			validate: ( { state, context }, playerId, input ) => {
				const [ frame ] = context.interactions.slice( -1 );
				if ( !frame || frame.kind !== SPLENDOR_NOBLE_VISIT ) {
					return fail( "claimNoble", "No noble is waiting on you!" );
				}

				const player = state.playerData[ playerId ]!;
				const willing = qualifyingNobles( player.cards, state.nobles );

				if ( !willing.some( noble => noble.id === input.nobleId ) ) {
					return fail( "claimNoble", "That noble is not willing to visit you!" );
				}

				return undefined;
			},

			// The choice is recorded as the frame's response; `resolve` is what turns
			// it into a visit, so the same code settles a frame that timed out.
			execute: () => []
		}
	},

	interactions: {
		[ SPLENDOR_NOBLE_VISIT ]: {
			responseMoves: [ "claimNoble" ],
			timeoutMillis: SPLENDOR_NOBLE_TIMEOUT_MILLIS,

			/**
			 * Sends in the noble the buyer named. The frame is resolved against the
			 * state as it stands — the purchase is already folded — so the choice is
			 * re-checked rather than trusted, and a frame that expired with no answer
			 * falls back to the first noble willing to come. Nobody is left waiting
			 * on a decision worth three points either way.
			 */
			resolve: ( { state }, frame ) => {
				const playerId = frame.initiator;
				const player = state.playerData[ playerId ];
				if ( !player ) {
					return [];
				}

				const willing = qualifyingNobles( player.cards, state.nobles );
				const response = frame.responses[ playerId ] as ClaimNobleInput | undefined;
				const chosen = willing.find( noble => noble.id === response?.nobleId ) ?? willing[ 0 ];

				return chosen ? [ NobleVisitedEvent.make( { playerId, noble: chosen } ) ] : [];
			}
		}
	},

	botMove: ( { state, context } ) => decideMove( state, context )
} );
