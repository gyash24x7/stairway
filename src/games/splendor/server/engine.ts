import type { Card, PartialTokens, PlayerData } from "@/games/splendor/schema";
import {
	CardPurchasedEvent,
	CardReservedEvent,
	GameDealtEvent,
	NobleVisitedEvent,
	PlayerDataInitializedEvent,
	SPLENDOR_BOT_DELAY_MILLIS,
	SPLENDOR_DEFAULT_WINNING_POINTS,
	SPLENDOR_GOLD_SUPPLY,
	SPLENDOR_MAX_RESERVED,
	SPLENDOR_MAX_TOKENS,
	SPLENDOR_MOVE_TIMEOUT_MILLIS,
	SPLENDOR_NOBLE_TIMEOUT_MILLIS,
	SPLENDOR_NOBLE_VISIT,
	SPLENDOR_OPEN_CARDS,
	SPLENDOR_TOKEN_SUPPLY,
	SplendorConfig,
	SplendorEvent,
	SplendorMoveSchemas,
	SplendorState,
	SplendorView,
	Tokens,
	TokensPickedEvent
} from "@/games/splendor/schema";
import { decideMove } from "@/games/splendor/server/bot";
import {
	ALL_GEMS,
	apply,
	DEFAULT_TOKENS,
	findOpenCard,
	findReservedCard,
	GEMS,
	generateDecks,
	generateNobles,
	hasLegalMove,
	isValidPayment,
	qualifiesForNoble,
	qualifyingNobles,
	standingsFor,
	sumTokens
} from "@/games/splendor/utils";
import { InvalidMove } from "@/swish/errors";
import { InteractionOpened, Standing, Standings } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { activeFrame, playerIdFor, responseOf } from "@/swish/utils";


/** Shorthand for the rejections below, which all read the same way. */
const refuse = ( move: string, reason: string ) => new InvalidMove( { move, reason } );

/** Every gem a (partial) token map actually names, the zeroes dropped. */
const gemsIn = ( tokens: PartialTokens ) => ALL_GEMS.filter( gem => ( tokens[ gem ] ?? 0 ) > 0 );

/**
 * Split a shuffled deck into the four cards that go face up and what is left to
 * draw. The two halves are the same slice, which is what keeps a card from being
 * both on the table and in the deck it is replaced from.
 */
const dealRow = ( deck: ReadonlyArray<Card> ) => ( {
	open: deck.slice( 0, SPLENDOR_OPEN_CARDS ),
	rest: deck.slice( SPLENDOR_OPEN_CARDS )
} );

/**
 * The card that turns up in a taken card's place, or `null` once that deck is
 * spent. Read here, in `execute`, so that the draw rides the emitted event:
 * `apply` re-runs on every replay and may never draw anything itself.
 */
const replacementFor = ( decks: SplendorState[ "decks" ], card: Card ) =>
	decks[ card.level ][ 0 ] ?? null;

/** The tokens a seat would hold once a take and its hand-back had landed. */
const tokensAfter = ( player: PlayerData, taken: PartialTokens ) => {
	const after = { ...DEFAULT_TOKENS };
	for ( const gem of ALL_GEMS ) {
		after[ gem ] = player.tokens[ gem ] + ( taken[ gem ] ?? 0 );
	}

	return after;
};


/**
 * Splendor's runtime, built from its declarative structure.
 *
 * Yielding it builds the command surface the API layer drives the game through —
 * the lifecycle commands, `submitMove`, the history cursor and `getView`.
 *
 * The type arguments are inferred rather than written out, and only from the
 * literal at this call site: `schemas.moves` is a homomorphic mapped type, which
 * is what recovers `MoveInputs` and feeds it to the contravariant
 * `MoveInputs[K]["Type"]` positions in each move's `validate`/`execute`. Lift
 * this object out into a `const` of its own and every one of those sites is
 * gone — the callback parameters fall back to `any`, and the structure stops
 * being assignable. Which is why it is written here, inline.
 */
export const {
	Engine: SplendorEngine,
	EngineLive: SplendorEngineLive,
	Structure: SplendorStructure
} = makeEngine( {
	name: "splendor",

	schemas: {
		state: SplendorState,
		config: SplendorConfig,
		events: SplendorEvent,
		view: SplendorView,
		moves: SplendorMoveSchemas
	},

	/**
	 * A full table, played to the printed fifteen, starting itself once the last
	 * seat fills. A four-handed game is long enough that one player walking away
	 * would otherwise strand three others — handing that seat to the policy
	 * through `autoPlay` plays it on rather than skipping it.
	 */
	defaultConfig: () => SplendorConfig.make( {
		playerCount: 4,
		winningPoints: SPLENDOR_DEFAULT_WINNING_POINTS,
		autoStart: true,
		botDelayMillis: SPLENDOR_BOT_DELAY_MILLIS,
		moveTimeoutMillis: SPLENDOR_MOVE_TIMEOUT_MILLIS
	} ),

	/**
	 * An empty table. Everything Splendor is laid out with is sized to the seats —
	 * the bank by how many are playing, the nobles at one more than that — and at
	 * creation the roster does not exist yet. So nothing is dealt here and the
	 * board arrives in one `GameDealt` from `onStart`, which is the first point
	 * there is a table to deal to.
	 */
	setup: () => SplendorState.make( {
		tokens: { ...DEFAULT_TOKENS },
		cards: { 1: [], 2: [], 3: [] },
		nobles: [],
		decks: { 1: [], 2: [], 3: [] },
		playerData: {}
	} ),

	apply,

	/**
	 * The printed finish: the game is over once a seat has reached the target
	 * *and* the round it happened in has been played out, so everyone has had the
	 * same number of turns and the seat that went last is not punished for it.
	 *
	 * `context.turn` is what expresses that. The end check runs after the turn
	 * tail, so by the time this is asked the counter has already moved past the
	 * turn that just finished — and since the table plays round-robin from
	 * `players[ 0 ]`, a counter divisible by the seat count is exactly the moment
	 * the last seat has acted. A seat reaching the target mid-round therefore
	 * fails this until the round comes back round, which is the rule.
	 *
	 * It is also safe at `start`, where the check runs once with the counter at
	 * zero: divisible, but nobody has any prestige yet.
	 */
	endIf: ( { state, config, context } ) => {
		const seats = context.players.length;
		if ( seats === 0 || context.turn % seats !== 0 ) {
			return false;
		}

		return context.players.some(
			playerId => ( state.playerData[ playerId ]?.points ?? 0 ) >= config.winningPoints
		);
	},

	/**
	 * Most prestige wins, and among seats level on prestige the one that got there
	 * with *fewer* development cards does — the printed tie-break, and the reason
	 * a seat still level on both is left sharing the rank with nobody named
	 * winner. All of it lives in `standingsFor`, which the archive and any test
	 * can read without the engine.
	 */
	resolveResults: ( { state, context } ) => {
		const { ranking, winner } = standingsFor( context.players, state.playerData );

		return Standings.make( {
			ranking: ranking.map( standing => Standing.make( standing ) ),
			...( winner ? { winner } : {} )
		} );
	},

	/**
	 * Splendor is a game of perfect information but for one thing: the order of
	 * the three decks. So the only redaction is that the decks become their
	 * lengths — modelled explicitly as `deckCounts` rather than left out, so a
	 * client renders one shape whoever is watching and can still show a row
	 * running dry.
	 *
	 * Reserved cards are deliberately not hidden. They were face up on the table
	 * when they were taken, and the whole point of the ten-token limit and the
	 * three-card reserve is that everyone can see what everyone else is building.
	 */
	view: ( { state }, audience ) => {
		const playerId = playerIdFor( audience );

		return SplendorView.make( {
			tokens: state.tokens,
			cards: state.cards,
			nobles: state.nobles,
			playerData: state.playerData,
			deckCounts: {
				1: state.decks[ 1 ].length,
				2: state.decks[ 2 ].length,
				3: state.decks[ 3 ].length
			},
			...( playerId ? { playerId } : {} )
		} );
	},

	hooks: {
		/**
		 * The board, dealt once the seats are known. The bank is sized to them, one
		 * more noble is drawn than there are players so somebody always misses out,
		 * and four cards of each level are turned up off the shuffled decks.
		 *
		 * Every shuffle here is drawn from the commit's seeded `rng`, salted per
		 * draw so the decks and the nobles are independent streams. The *outcome*
		 * rides `GameDealt`, which is what replay folds — this hook never runs
		 * again.
		 */
		onStart: ( { config, context }, rng ) => {
			const supply = SPLENDOR_TOKEN_SUPPLY[ config.playerCount ];
			const decks = generateDecks( rng( "decks" ).next );
			const nobles = generateNobles( config.playerCount, rng( "nobles" ).next );

			const rows = {
				1: dealRow( decks[ 1 ] ),
				2: dealRow( decks[ 2 ] ),
				3: dealRow( decks[ 3 ] )
			};

			return [
				GameDealtEvent.make( {
					tokens: Tokens.make( {
						diamond: supply,
						sapphire: supply,
						emerald: supply,
						ruby: supply,
						onyx: supply,
						gold: SPLENDOR_GOLD_SUPPLY
					} ),
					nobles,
					cards: { 1: rows[ 1 ].open, 2: rows[ 2 ].open, 3: rows[ 3 ].open },
					decks: { 1: rows[ 1 ].rest, 2: rows[ 2 ].rest, 3: rows[ 3 ].rest }
				} ),
				...context.players.map( playerId => PlayerDataInitializedEvent.make( { playerId } ) )
			];
		},

		/**
		 * The noble visit, in the ordinary case: exactly one noble is willing to
		 * come, so nobody is being asked anything and it simply happens. Awarding it
		 * here rather than making the buyer play a move for it is what keeps a visit
		 * from reading as a turn of its own — it is a consequence of the purchase,
		 * folded into the very same commit.
		 *
		 * The choice — two or more willing at once — belongs to the player, so that
		 * case opens the `noble-visit` window below rather than picking for them.
		 * The two branches are exclusive by construction: one qualifying noble is
		 * awarded and none is left to open a window over, two or more opens one and
		 * awards nothing.
		 *
		 * Gated on the move name because a hook fires for a response as well as for
		 * a turn action: without it, settling the window with `claimNoble` would
		 * immediately award the *other* noble too, and only one ever visits per turn.
		 * A purchase is also the only move that can change a seat's bonuses at all.
		 */
		afterMove: ( { state }, playerId, moveType ) => {
			if ( moveType !== "purchaseCard" ) {
				return [];
			}

			const player = state.playerData[ playerId ];
			const qualifying = player ? qualifyingNobles( player.cards, state.nobles ) : [];

			if ( qualifying.length === 1 ) {
				return [ NobleVisitedEvent.make( { playerId, noble: qualifying[ 0 ]! } ) ];
			}

			// Nobody but the buyer is being asked, and the options are the window
			// kind's own — there is exactly one move to answer with.
			return qualifying.length > 1
				? [
					InteractionOpened.make( {
						kind: SPLENDOR_NOBLE_VISIT,
						initiator: playerId,
						subject: playerId,
						responders: [ playerId ]
					} )
				]
				: [];
		}
	},

	moves: {
		/**
		 * Take gems. Three different ones, or two of a single colour when that pile
		 * is deep enough to stand it, and hand back down to ten before the turn ends.
		 */
		pickTokens: {
			validate: ( { state }, playerId, input ) => {
				const player = state.playerData[ playerId ];
				if ( !player ) {
					return refuse( "pickTokens", "You are not seated at this table." );
				}

				if ( ( input.tokens.gold ?? 0 ) > 0 ) {
					return refuse( "pickTokens", "Gold is only ever taken with a reservation." );
				}

				const picked = gemsIn( input.tokens );
				if ( picked.length === 0 ) {
					return refuse( "pickTokens", "Take at least one gem." );
				}

				for ( const gem of picked ) {
					if ( state.tokens[ gem ] < input.tokens[ gem ]! ) {
						return refuse( "pickTokens", `The bank does not hold that many ${ gem }.` );
					}
				}

				const double = picked.find( gem => input.tokens[ gem ]! >= 2 );
				if ( double ) {
					if ( picked.length > 1 || input.tokens[ double ] !== 2 ) {
						return refuse( "pickTokens", "Two of a kind is two gems and nothing else." );
					}

					if ( state.tokens[ double ] < 4 ) {
						return refuse(
							"pickTokens",
							`Two ${ double } needs four of them left in the pile.`
						);
					}
				} else {
					// Under-taking is not a choice: three different gems, or every colour
					// still in the bank when it cannot manage three. Otherwise a seat could
					// starve the table by taking one gem a turn.
					const allowed = Math.min( 3, GEMS.filter( gem => state.tokens[ gem ] > 0 ).length );
					if ( picked.length !== allowed ) {
						return refuse( "pickTokens", `Take ${ allowed } different gems.` );
					}
				}

				// The limit is settled inside this move rather than by a follow-up, so a
				// seat is never left mid-turn holding eleven.
				const after = tokensAfter( player, input.tokens );
				const excess = Math.max( 0, sumTokens( after ) - SPLENDOR_MAX_TOKENS );
				const returned = input.returned ?? {};

				if ( sumTokens( returned ) !== excess ) {
					return refuse(
						"pickTokens",
						excess === 0
							? "You are under the token limit; nothing has to go back."
							: `Put ${ excess } token(s) back to stay at ${ SPLENDOR_MAX_TOKENS }.`
					);
				}

				for ( const gem of ALL_GEMS ) {
					if ( ( returned[ gem ] ?? 0 ) > after[ gem ] ) {
						return refuse( "pickTokens", `You would not hold that many ${ gem } to put back.` );
					}
				}

				return;
			},

			execute: ( _data, playerId, input ) => [
				TokensPickedEvent.make( {
					playerId,
					tokens: input.tokens,
					...( input.returned ? { returned: input.returned } : {} )
				} )
			]
		},

		/**
		 * Put a face-up card aside for later, and take the gold that comes with it.
		 *
		 * Only from the rows. The printed game also lets a seat reserve blind off the
		 * top of a deck, but the input names a card by id and the deck's order is the
		 * one thing a client is never told — there is no id it could send.
		 */
		reserveCard: {
			validate: ( { state }, playerId, input ) => {
				const player = state.playerData[ playerId ];
				if ( !player ) {
					return refuse( "reserveCard", "You are not seated at this table." );
				}

				if ( player.reserved.length >= SPLENDOR_MAX_RESERVED ) {
					return refuse(
						"reserveCard",
						`You may hold at most ${ SPLENDOR_MAX_RESERVED } cards in reserve.`
					);
				}

				if ( !findOpenCard( input.cardId, state.cards ) ) {
					return refuse( "reserveCard", "That card is not face up on the table." );
				}

				if ( input.withGold && state.tokens.gold <= 0 ) {
					return refuse( "reserveCard", "There is no gold left to take." );
				}

				const after = tokensAfter( player, input.withGold ? { gold: 1 } : {} );
				const excess = Math.max( 0, sumTokens( after ) - SPLENDOR_MAX_TOKENS );

				if ( excess > 0 && !input.returnedToken ) {
					return refuse(
						"reserveCard",
						`That gold puts you over ${ SPLENDOR_MAX_TOKENS }: name a token to put back.`
					);
				}

				if ( input.returnedToken ) {
					if ( excess === 0 ) {
						return refuse(
							"reserveCard",
							"You are under the token limit; nothing has to go back."
						);
					}

					if ( after[ input.returnedToken ] <= 0 ) {
						return refuse( "reserveCard", "You do not hold that token to put back." );
					}
				}

				return;
			},

			execute: ( { state }, playerId, input ) => {
				const card = findOpenCard( input.cardId, state.cards )!;

				return [
					CardReservedEvent.make( {
						playerId,
						card,
						replacement: replacementFor( state.decks, card ),
						withGold: input.withGold,
						...( input.returnedToken ? { returnedToken: input.returnedToken } : {} )
					} )
				];
			}
		},

		/**
		 * Buy a card, off the table or out of your own reserve.
		 *
		 * The payment is the caller's rather than the server's: a seat holding both
		 * gems and gold has a real choice about which to spend, and `isValidPayment`
		 * checks the split settles the discounted price exactly — no gem overpaid, no
		 * gold spent that a gem could have covered's worth left in the bank.
		 */
		purchaseCard: {
			validate: ( { state }, playerId, input ) => {
				const player = state.playerData[ playerId ];
				if ( !player ) {
					return refuse( "purchaseCard", "You are not seated at this table." );
				}

				const card = findReservedCard( input.cardId, player )
					?? findOpenCard( input.cardId, state.cards );

				if ( !card ) {
					return refuse( "purchaseCard", "That card is neither on the table nor in your reserve." );
				}

				if ( !isValidPayment( card, input.payment, player.cards ) ) {
					return refuse( "purchaseCard", "That payment does not settle the card exactly." );
				}

				for ( const gem of ALL_GEMS ) {
					if ( ( input.payment[ gem ] ?? 0 ) > player.tokens[ gem ] ) {
						return refuse( "purchaseCard", `You do not hold that many ${ gem }.` );
					}
				}

				return;
			},

			execute: ( { state }, playerId, input ) => {
				const player = state.playerData[ playerId ]!;
				const reserved = findReservedCard( input.cardId, player );
				const card = reserved ?? findOpenCard( input.cardId, state.cards )!;

				return [
					CardPurchasedEvent.make( {
						playerId,
						card,
						fromReserved: reserved !== undefined,
						replacement: reserved ? null : replacementFor( state.decks, card ),
						payment: input.payment
					} )
				];
			}
		},

		/**
		 * Give up the turn. Legal only when the rules have left the seat nothing to
		 * do — an empty bank, no room to reserve and nothing it can pay for — so a
		 * seat can never stall a table by declining to play.
		 *
		 * `hasLegalMove` is the same question asked three ways that the three moves
		 * above answer, which is what keeps this gate and them from drifting apart.
		 * It emits nothing: the commit is the turn tail alone.
		 */
		passTurn: {
			validate: ( { state }, playerId ) => {
				const player = state.playerData[ playerId ];
				if ( !player ) {
					return refuse( "pass", "You are not seated at this table." );
				}

				return hasLegalMove( state, player )
					? refuse( "pass", "You still have a legal move; passing is a last resort." )
					: undefined;
			},

			execute: () => []
		},

		/**
		 * Settle a `noble-visit`: say which of the nobles now willing to come
		 * actually does. Named by the window below, which makes it a response move —
		 * the engine refuses it outside an open window rather than letting it be
		 * played as a turn of its own.
		 */
		claimNoble: {
			validate: ( { state, context }, playerId, input ) => {
				const player = state.playerData[ playerId ];
				if ( !player ) {
					return refuse( "claimNoble", "You are not seated at this table." );
				}

				// A response and nothing else. Without this it would be playable as a
				// turn of its own — a free extra move for any seat whose cards happen
				// to qualify, on a turn it had not earned.
				if ( activeFrame( context )?.kind !== SPLENDOR_NOBLE_VISIT ) {
					return refuse(
						"claimNoble",
						"A noble is only claimed when the table asks you to choose between them."
					);
				}

				const noble = state.nobles.find( candidate => candidate.id === input.nobleId );
				if ( !noble ) {
					return refuse( "claimNoble", "That noble is no longer on the table." );
				}

				return qualifiesForNoble( player.cards, noble.cost )
					? undefined
					: refuse( "claimNoble", "Your cards do not meet that noble's requirement." );
			},

			execute: ( { state }, playerId, input ) => {
				const noble = state.nobles.find( candidate => candidate.id === input.nobleId )!;
				return [ NobleVisitedEvent.make( { playerId, noble } ) ];
			}
		}
	},

	interactions: {

		/**
		 * Which of the nobles now willing to visit actually does.
		 *
		 * Opened by `afterMove` when a purchase leaves two or more qualifying, and
		 * only then: one is awarded outright, and none is nothing to ask about. The
		 * buyer is the only responder, because it is their kingdom the nobles are
		 * coming to — nobody else has anything to say.
		 *
		 * Mandatory. A visit is worth prestige and the game will not let it be
		 * declined into nothing, so when the clock runs out the policy is asked, and
		 * if even that has nothing to say `onResolve` takes the first one still on
		 * the table. The options are the kind's own move list, since there is
		 * exactly one move to answer with and everyone who may answer may play it.
		 */
		[ SPLENDOR_NOBLE_VISIT ]: {
			moves: [ "claimNoble" ],
			resolution: "all",
			allowPass: false,
			timeoutMillis: SPLENDOR_NOBLE_TIMEOUT_MILLIS,

			onResolve: ( { state }, frame ) => {
				const playerId = frame.responders[ 0 ];
				if ( !playerId ) {
					return [];
				}

				// Answered already: `claimNoble` awarded the one they chose, and only
				// one noble ever visits per turn.
				if ( responseOf( frame, playerId )?.outcome === "answered" ) {
					return [];
				}

				const player = state.playerData[ playerId ];
				const noble = player ? qualifyingNobles( player.cards, state.nobles )[ 0 ] : undefined;

				return noble ? [ NobleVisitedEvent.make( { playerId, noble } ) ] : [];
			}
		}
	},

	/**
	 * A greedy policy: settle any noble waiting on the seat, then buy the best
	 * card it can pay for, else take the gems the board is asking for, else
	 * reserve, else pass. It is handed the redacted `View`, not the state, so it
	 * plays on exactly the information the seat it stands in for would have — the
	 * deck orders included, which is to say not at all.
	 */
	botMove: ( { state } ) => decideMove( state ),

	/**
	 * Which noble a machine-played seat takes: the one worth the most, and the
	 * first of those on the table when several are worth the same.
	 *
	 * Deliberately simple, and deliberately not a pass — the window cannot be
	 * declined, so a policy with nothing to say only hands the choice to
	 * `onResolve`, which would take the leftmost rather than the best.
	 */
	botRespond: ( { state }, frame ) => {
		if ( frame.kind !== SPLENDOR_NOBLE_VISIT ) {
			return undefined;
		}

		const playerId = state.playerId;
		const player = playerId ? state.playerData[ playerId ] : undefined;
		if ( !player ) {
			return undefined;
		}

		const best = qualifyingNobles( player.cards, state.nobles )
			.reduce<typeof state.nobles[ number ] | undefined>(
				( chosen, noble ) => !chosen || noble.points > chosen.points ? noble : chosen,
				undefined
			);

		return best
			? { moveType: "claimNoble" as const, input: { nobleId: best.id } }
			: undefined;
	}
} );
