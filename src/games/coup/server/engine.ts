import { decideMove } from "@/games/coup/server/bot.ts";
import {
	apply,
	freshDeck,
	holds,
	isPlaying,
	isSubMultiset,
	livingIn,
	removeEach,
	returnToDeck,
	standingsFor
} from "@/games/coup/server/utils.ts";
import {
	ActionBlocked,
	ActionDeclared,
	ActionFizzled,
	ActionResolved,
	BlockInput,
	CardSwapped,
	ChallengeFailed,
	ChallengeInput,
	ChallengeMade,
	ChallengeSucceeded,
	CoinsChanged,
	COUP_BLOCK_ACTION,
	COUP_CHALLENGE_ACTION,
	COUP_CHALLENGE_BLOCK,
	COUP_CHOICE_TIMEOUT_MILLIS,
	COUP_EXCHANGE,
	COUP_EXCHANGE_DRAW,
	COUP_FOREIGN_AID_AMOUNT,
	COUP_INCOME_AMOUNT,
	COUP_LOSE_INFLUENCE,
	COUP_MOVE_TIMEOUT_MILLIS,
	COUP_REACTION_TIMEOUT_MILLIS,
	COUP_STARTING_COINS,
	COUP_STARTING_INFLUENCE,
	COUP_TAX_AMOUNT,
	CoupConfig,
	CoupEvent,
	CoupState,
	CoupView,
	ExchangeCardsInput,
	ExchangeCompleted,
	ExchangeDrawn,
	GameDealt,
	InfluenceLost,
	LogEntry,
	Logged,
	PendingAction,
	PendingCleared,
	PlayerEliminated,
	SurrenderInfluenceInput,
	TakeActionInput
} from "@/games/coup/shared/schema.ts";
import {
	canBlockWith,
	claimFor,
	costOf,
	isBlockable,
	legalActions,
	mustCoup,
	needsTarget,
	stealAmount
} from "@/games/coup/shared/utils.ts";
import { makeEngine } from "@/swish/server/engine.ts";
import { playerIdFor } from "@/swish/server/utils.ts";
import {
	InteractionFrame,
	InteractionOpened,
	InvalidMove,
	SeatStatusChanged
} from "@/swish/shared/schema.ts";

import type {
	BlockInput as Block,
	ChallengeInput as Challenge,
	CharacterCard,
	ExchangeCardsInput as Exchange,
	LossOutcome,
	PendingAction as Pending,
	SurrenderInfluenceInput as Surrender
} from "@/games/coup/shared/schema.ts";
import type { Rng } from "@/shared/utils/rng.ts";
import type { GameData, PlayerId } from "@/swish/shared/schema.ts";


// --- Local helpers ---------------------------------------------------------

type Data = GameData<CoupState, CoupConfig>;

const fail = ( move: string, reason: string ) => new InvalidMove( { move, reason } );

/** One line for the table's history. */
const note = (
	data: Data,
	actor: PlayerId,
	text: string,
	extra: Partial<LogEntry> = {}
) => Logged.make( {
	entry: LogEntry.make( { turn: data.context.turn, actor, note: text, ...extra } )
} );

/** The top of the interaction stack, which is the only frame that can be answered. */
const activeFrame = ( data: Data ) => data.context.interactions.slice( -1 )[ 0 ];

/** Everyone still in the game but the one named, in seating order. */
const opponentsOf = ( data: Data, playerId: PlayerId ) =>
	livingIn( data.state, data.context.players ).filter( id => id !== playerId );


// --- Frames ----------------------------------------------------------------

/**
 * Every frame in a turn's chain names the turn's owner as its `initiator`,
 * whoever it is actually waiting on.
 *
 * That field is the engine's, not the game's: when the stack finally empties the
 * turn advances from the bottom frame's initiator. A `lose-influence` frame that
 * named the seat *losing* the influence would hand the next turn to whoever
 * happened to be challenged, so who a frame is about is carried by `target`
 * instead, and who must answer it by `responders`.
 */
const frame = (
	pending: Pending,
	kind: string,
	responders: ReadonlyArray<PlayerId>,
	extra: { target?: PlayerId; payload?: string } = {}
) => InteractionOpened.make( {
	frame: InteractionFrame.make( {
		kind,
		initiator: pending.actor,
		responders,
		mode: kind === COUP_LOSE_INFLUENCE || kind === COUP_EXCHANGE
			? "sequential"
			: "simultaneous",
		responses: {},
		...( extra.target === undefined ? {} : { target: extra.target } ),
		...( extra.payload === undefined ? {} : { payload: extra.payload } )
	} )
} );

/** Who may stop this action: its target, or the whole table for foreign aid. */
const blockRespondersFor = ( data: Data, pending: Pending ) => {
	if ( !isBlockable( pending.action ) ) {
		return [];
	}

	return pending.action === "foreignAid"
		? opponentsOf( data, pending.actor )
		: isPlaying( data.state, pending.target ) ? [ pending.target! ] : [];
};


// --- Effects ---------------------------------------------------------------

/**
 * Puts a proven claim back and takes a fresh card.
 *
 * Both cards ride the event rather than being recomputed on replay: the
 * replacement is drawn here, and naming the card going back is what tells a
 * replay which of two identical copies left the hand.
 */
const swapProvenCard = (
	data: Data,
	playerId: PlayerId,
	card: CharacterCard,
	rng: ( salt?: string ) => Rng
) => {
	const deck = returnToDeck( data.state.deck, [ card ], rng( `swap:${ playerId }` ) );
	const [ drawn, ...rest ] = deck;

	return drawn === undefined
		? []
		: [ CardSwapped.make( { playerId, returned: card, drawn, deck: rest } ) ];
};

/**
 * Lands the action, now that nothing is left that could have stopped it.
 *
 * The two removal actions do not finish here — they open the window that asks
 * their target which card to give up, and the turn's `pending` is cleared when
 * *that* settles. Same for an exchange, which is waiting on its own seat.
 */
const applyEffects = (
	data: Data,
	pending: Pending,
	_rng: ( salt?: string ) => Rng
) => {
	const { action, actor, target } = pending;
	const resolved = ActionResolved.make( {
		action,
		actor,
		...( target === undefined ? {} : { target } )
	} );

	const gain = ( amount: number ) => [
		CoinsChanged.make( { playerId: actor, delta: amount, reason: action } ),
		resolved,
		PendingCleared.make( {} )
	];

	switch ( action ) {
		case "income":
			return [ note( data, actor, "took income" ), ...gain( COUP_INCOME_AMOUNT ) ];

		case "foreignAid":
			return [ note( data, actor, "took foreign aid" ), ...gain( COUP_FOREIGN_AID_AMOUNT ) ];

		case "tax":
			return [ note( data, actor, "taxed as the Duke" ), ...gain( COUP_TAX_AMOUNT ) ];

		case "steal": {
			// A target that went out during the challenge chain has nothing left to
			// take, and neither does one that was already empty. The Captain was
			// still played either way — this is the action landing on nothing, not
			// the action being refused.
			const amount = isPlaying( data.state, target )
				? stealAmount( data.state.playerData[ target! ]?.coins ?? 0 )
				: 0;

			return [
				note( data, actor, `stole ${ amount }`, target === undefined ? {} : { target } ),
				...( amount === 0
					? []
					: [
						CoinsChanged.make( { playerId: target!, delta: -amount, reason: "steal" } ),
						CoinsChanged.make( { playerId: actor, delta: amount, reason: "steal" } )
					] ),
				resolved,
				PendingCleared.make( {} )
			];
		}

		case "exchange": {
			const drawn = data.state.deck.slice( 0, COUP_EXCHANGE_DRAW );

			return [
				note( data, actor, "exchanged with the court" ),
				ExchangeDrawn.make( {
					playerId: actor,
					drawn,
					deck: data.state.deck.slice( drawn.length )
				} ),
				frame( pending, COUP_EXCHANGE, [ actor ], { target: actor } )
			];
		}

		case "assassinate":
		case "coup": {
			// The target may have gone out earlier in the same turn — a seat on one
			// card that challenged the assassin and lost is already gone by the time
			// the assassination would land.
			if ( !isPlaying( data.state, target ) ) {
				return [
					ActionFizzled.make( { action, actor, reason: "the target was already out" } ),
					PendingCleared.make( {} )
				];
			}

			return [
				note( data, actor, action === "coup" ? "launched a coup" : "sent the assassin", {
					target: target!
				} ),
				resolved,
				frame( pending, COUP_LOSE_INFLUENCE, [ target! ], {
					target: target!,
					payload: "none" satisfies LossOutcome
				} )
			];
		}
	}
};

/**
 * The tail every surviving claim runs through: offer the block window if the
 * action has one and somebody is left to play it, otherwise land the action.
 */
const advance = (
	data: Data,
	pending: Pending,
	rng: ( salt?: string ) => Rng
) => {
	const responders = blockRespondersFor( data, pending );

	return responders.length > 0
		? [ frame( pending, COUP_BLOCK_ACTION, responders, (
			pending.target === undefined ? {} : { target: pending.target }
		) ) ]
		: applyEffects( data, pending, rng );
};

/**
 * Settles a challenge, wherever it was aimed.
 *
 * The shape is the same whether the claim was an action's or a block's: the
 * claimant either shows the card, in which case the challenger pays for the
 * accusation and the claim's own card is swapped out, or they do not, in which
 * case they pay. What differs is only what becomes of the action, which is why
 * the two outcomes are passed in.
 */
const settleChallenge = (
	data: Data,
	pending: Pending,
	claimant: PlayerId,
	claim: CharacterCard,
	challenger: PlayerId,
	rng: ( salt?: string ) => Rng,
	outcomes: { readonly proven: LossOutcome; readonly bluffed: LossOutcome }
) => {
	const influence = data.state.playerData[ claimant ]?.influence ?? [];

	if ( holds( influence, claim ) ) {
		return [
			ChallengeFailed.make( { challenger, claimant, claim } ),
			note( data, claimant, `showed the ${ claim }`, { card: claim } ),
			...swapProvenCard( data, claimant, claim, rng ),
			frame( pending, COUP_LOSE_INFLUENCE, [ challenger ], {
				target: challenger,
				payload: outcomes.proven
			} )
		];
	}

	return [
		ChallengeSucceeded.make( { challenger, claimant, claim } ),
		note( data, challenger, `caught the bluffed ${ claim }`, { card: claim } ),
		frame( pending, COUP_LOSE_INFLUENCE, [ claimant ], {
			target: claimant,
			payload: outcomes.bluffed
		} )
	];
};

/** The responder who called a bluff, if any did. */
const challengerIn = ( responses: Record<PlayerId, unknown>, responders: ReadonlyArray<PlayerId> ) =>
	responders.find( id => ( responses[ id ] as Challenge | undefined )?.challenge === true );


// --- Engine ----------------------------------------------------------------

export const coup = makeEngine( {
	name: "coup",

	schemas: {
		state: CoupState,
		config: CoupConfig,
		events: CoupEvent,
		view: CoupView,
		moves: {
			takeAction: TakeActionInput,
			challenge: ChallengeInput,
			block: BlockInput,
			surrenderInfluence: SurrenderInfluenceInput,
			exchangeCards: ExchangeCardsInput
		}
	},

	defaultConfig: () => CoupConfig.make( {
		playerCount: 4,
		autoStart: false,
		moveTimeoutMillis: COUP_MOVE_TIMEOUT_MILLIS,
		interactionTimeoutMillis: COUP_REACTION_TIMEOUT_MILLIS
	} ),

	// The table is empty at `initialize`, so there is nobody to deal to yet. The
	// deck is built and shuffled in `onStart`, where the roster exists.
	setup: () => CoupState.make( {
		deck: [],
		playerData: {},
		eliminationOrder: [],
		log: []
	} ),

	apply,

	endIf: ( { state, context } ) => livingIn( state, context.players ).length <= 1,

	resolveResults: ( { state, context } ) => standingsFor( context.players, state ),

	/**
	 * Three regions are hidden and every one of them is modelled as something
	 * rather than left out: an opponent's hand as a count, the deck as a length,
	 * and an exchange's draw as a field only its own seat's view fills.
	 */
	view: ( { state }, audience ) => {
		const playerId = playerIdFor( audience );
		const own = playerId ? state.playerData[ playerId ] : undefined;

		return CoupView.make( {
			playerData: Object.fromEntries(
				Object.entries( state.playerData ).map( ( [ id, player ] ) => [
					id,
					{ coins: player.coins, influenceCount: player.influence.length }
				] )
			),
			deckCount: state.deck.length,
			influence: own?.influence ?? [],
			eliminationOrder: state.eliminationOrder,
			log: state.log,
			...( state.pending === undefined ? {} : { pending: state.pending } ),
			...( state.exchangeDraw !== undefined && playerId === state.pending?.actor
				? { exchangeDraw: state.exchangeDraw }
				: {} ),
			playerId
		} );
	},

	hooks: {
		/**
		 * Builds the deck, shuffles it and deals. One event rather than one per
		 * seat, because it is one shuffle: a replay folding them separately could
		 * interleave them with something else and deal a different game.
		 */
		onStart: ( { context }, rng ) => {
			const deck = rng( "deal" ).shuffle( freshDeck() );

			const hands = context.players.reduce<Record<PlayerId, ReadonlyArray<CharacterCard>>>(
				( acc, playerId, seat ) => {
					const from = seat * COUP_STARTING_INFLUENCE;
					acc[ playerId ] = deck.slice( from, from + COUP_STARTING_INFLUENCE );
					return acc;
				},
				{}
			);

			return [
				GameDealt.make( {
					hands,
					coins: COUP_STARTING_COINS,
					deck: deck.slice( context.players.length * COUP_STARTING_INFLUENCE )
				} )
			];
		}
	},

	moves: {
		takeAction: {
			validate: ( data, playerId, input ) => {
				const { action, target } = input;
				const coins = data.state.playerData[ playerId ]?.coins ?? 0;

				if ( mustCoup( coins ) && action !== "coup" ) {
					return fail( "takeAction", "You hold ten coins — you must launch a coup." );
				}

				if ( !legalActions( coins ).includes( action ) ) {
					return fail( "takeAction", `You cannot afford to ${ action }.` );
				}

				if ( needsTarget( action ) ) {
					if ( target === undefined ) {
						return fail( "takeAction", "That action needs someone to aim at." );
					}

					if ( target === playerId ) {
						return fail( "takeAction", "You cannot aim that at yourself." );
					}

					if ( !isPlaying( data.state, target ) ) {
						return fail( "takeAction", "That player is already out." );
					}
				} else if ( target !== undefined ) {
					return fail( "takeAction", "That action is not aimed at anybody." );
				}

				return undefined;
			},

			/**
			 * Declares the action, pays for it, and opens whatever the table gets to
			 * say about it: a challenge window when a character was claimed, a block
			 * window when nothing was claimed but something can still stop it, and
			 * neither for income or a coup, which land where they stand.
			 *
			 * The cost is spent here and never comes back. An assassination that is
			 * challenged down or blocked still cost its three coins, which is what
			 * stops a seat probing for a Contessa for free.
			 */
			execute: ( data, playerId, input, rng ) => {
				const claim = claimFor( input.action );
				const pending = PendingAction.make( {
					action: input.action,
					actor: playerId,
					...( input.target === undefined ? {} : { target: input.target } ),
					...( claim === undefined ? {} : { claim } )
				} );

				const cost = costOf( input.action );
				const paid = cost === 0
					? []
					: [ CoinsChanged.make( { playerId, delta: -cost, reason: input.action } ) ];

				const opening = [ ActionDeclared.make( { pending } ), ...paid ];

				// A claim goes to the table first. Everything else has already been
				// paid for and only has its block window left to face, if it has one.
				if ( claim !== undefined ) {
					const responders = opponentsOf( data, playerId );

					return responders.length === 0
						? [ ...opening, ...advance( data, pending, rng ) ]
						: [
							...opening,
							note( data, playerId, `claims the ${ claim }`, { action: input.action, card: claim } ),
							frame( pending, COUP_CHALLENGE_ACTION, responders, (
								input.target === undefined ? {} : { target: input.target }
							) )
						];
				}

				return [ ...opening, ...advance( data, pending, rng ) ];
			}
		},

		challenge: {
			validate: ( data, playerId ) => {
				const open = activeFrame( data );

				if ( open?.kind !== COUP_CHALLENGE_ACTION && open?.kind !== COUP_CHALLENGE_BLOCK ) {
					return fail( "challenge", "There is nothing to challenge." );
				}

				return open.responders.includes( playerId )
					? undefined
					: fail( "challenge", "This one is not yours to challenge." );
			},

			// The answer is the frame's response; `resolve` is what turns it into a
			// challenge, so the same code settles a window that timed out.
			execute: () => [],
			endsTurn: false
		},

		block: {
			validate: ( data, playerId, input ) => {
				const open = activeFrame( data );

				if ( open?.kind !== COUP_BLOCK_ACTION ) {
					return fail( "block", "There is nothing to block." );
				}

				if ( !open.responders.includes( playerId ) ) {
					return fail( "block", "This one is not yours to block." );
				}

				const action = data.state.pending?.action;

				if ( input.block !== null && ( !action || !canBlockWith( action, input.block ) ) ) {
					return fail( "block", `The ${ input.block } cannot stop that.` );
				}

				return undefined;
			},

			execute: () => [],
			endsTurn: false
		},

		surrenderInfluence: {
			validate: ( data, playerId, input ) => {
				const open = activeFrame( data );

				if ( open?.kind !== COUP_LOSE_INFLUENCE || open.target !== playerId ) {
					return fail( "surrenderInfluence", "Nothing is being taken from you." );
				}

				return holds( data.state.playerData[ playerId ]?.influence ?? [], input.card )
					? undefined
					: fail( "surrenderInfluence", "You are not holding that card." );
			},

			execute: () => [],
			endsTurn: false
		},

		exchangeCards: {
			validate: ( data, playerId, input ) => {
				const open = activeFrame( data );

				if ( open?.kind !== COUP_EXCHANGE || open.target !== playerId ) {
					return fail( "exchangeCards", "You are not exchanging." );
				}

				const influence = data.state.playerData[ playerId ]?.influence ?? [];
				const pool = [ ...influence, ...( data.state.exchangeDraw ?? [] ) ];

				if ( input.keep.length !== influence.length ) {
					return fail(
						"exchangeCards",
						`You must keep exactly ${ influence.length }.`
					);
				}

				return isSubMultiset( pool, input.keep )
					? undefined
					: fail( "exchangeCards", "You were not offered those cards." );
			},

			execute: () => [],
			endsTurn: false
		}
	},

	interactions: {

		/**
		 * The table's chance to call a claim a bluff. Simultaneous, and closed by
		 * the first challenge to land rather than by the last responder to answer —
		 * whoever speaks first is the challenger, as at a real table. Everyone
		 * else's window is dropped.
		 */
		[ COUP_CHALLENGE_ACTION ]: {
			responseMoves: [ "challenge" ],
			timeoutMillis: COUP_REACTION_TIMEOUT_MILLIS,

			isComplete: ( _data, open ) =>
				challengerIn( open.responses, open.responders ) !== undefined
				|| open.responders.every( id => id in open.responses ),

			// Silence is a pass: the claim stands and the action carries on.
			onTimeout: ( data, _open, rng ) => {
				const pending = data.state.pending;
				return pending ? advance( data, pending, rng ) : [];
			},

			resolve: ( data, open, rng ) => {
				const pending = data.state.pending;
				if ( !pending?.claim ) {
					return [];
				}

				const challenger = challengerIn( open.responses, open.responders );

				if ( challenger === undefined ) {
					return advance( data, pending, rng );
				}

				return [
					ChallengeMade.make( { challenger, claimant: pending.actor, claim: pending.claim } ),
					...settleChallenge( data, pending, pending.actor, pending.claim, challenger, rng, {
						// The claim was honest, so the action goes on to whatever block
						// window it has. The accusation is what costs.
						proven: "continue-action",

						// The claim was a bluff, so the action never happens.
						bluffed: "abort-action"
					} )
				];
			}
		},

		/**
		 * The chance to stop an action by claiming a character of one's own.
		 * Simultaneous and closed by the first block, so a foreign aid facing three
		 * Dukes is stopped once rather than three times.
		 */
		[ COUP_BLOCK_ACTION ]: {
			responseMoves: [ "block" ],
			timeoutMillis: COUP_REACTION_TIMEOUT_MILLIS,

			isComplete: ( _data, open ) =>
				open.responders.some( id => ( open.responses[ id ] as Block | undefined )?.block )
				|| open.responders.every( id => id in open.responses ),

			onTimeout: ( data, _open, rng ) => {
				const pending = data.state.pending;
				return pending ? applyEffects( data, pending, rng ) : [];
			},

			resolve: ( data, open, rng ) => {
				const pending = data.state.pending;
				if ( !pending ) {
					return [];
				}

				const blocker = open.responders.find(
					id => ( open.responses[ id ] as Block | undefined )?.block
				);
				const card = blocker
					? ( open.responses[ blocker ] as Block | undefined )?.block ?? undefined
					: undefined;

				if ( !blocker || !card ) {
					return applyEffects( data, pending, rng );
				}

				const blocked = { ...pending, block: { by: blocker, card } };

				return [
					ActionBlocked.make( { by: blocker, card } ),
					note( data, blocker, `blocks with the ${ card }`, { card } ),
					frame( blocked, COUP_CHALLENGE_BLOCK, opponentsOf( data, blocker ), { target: blocker } )
				];
			}
		},

		/**
		 * The chance to call the *block* a bluff. Open to everyone still playing
		 * but the blocker — usually the seat whose action was stopped, though
		 * anybody may.
		 */
		[ COUP_CHALLENGE_BLOCK ]: {
			responseMoves: [ "challenge" ],
			timeoutMillis: COUP_REACTION_TIMEOUT_MILLIS,

			isComplete: ( _data, open ) =>
				challengerIn( open.responses, open.responders ) !== undefined
				|| open.responders.every( id => id in open.responses ),

			// Nobody doubted the block, so it stands and the action does not happen.
			onTimeout: ( data ) => {
				const pending = data.state.pending;
				return pending
					? [
						ActionFizzled.make( {
							action: pending.action,
							actor: pending.actor,
							reason: "blocked"
						} ),
						PendingCleared.make( {} )
					]
					: [];
			},

			resolve: ( data, open, rng ) => {
				const pending = data.state.pending;
				const block = pending?.block;

				if ( !pending || !block ) {
					return [];
				}

				const challenger = challengerIn( open.responses, open.responders );

				if ( challenger === undefined ) {
					return [
						note( data, block.by, `blocked with the ${ block.card }`, { card: block.card } ),
						ActionFizzled.make( {
							action: pending.action,
							actor: pending.actor,
							reason: "blocked"
						} ),
						PendingCleared.make( {} )
					];
				}

				return [
					ChallengeMade.make( { challenger, claimant: block.by, claim: block.card } ),
					...settleChallenge( data, pending, block.by, block.card, challenger, rng, {
						// The block was honest. It stands, so the action still does not
						// happen — the challenger simply paid for doubting it.
						proven: "abort-action",

						// The block was a bluff. Nothing is left between the action and
						// its target, so it lands — and the blocker has already given up
						// an influence for the attempt. That is how a bluffed Contessa
						// costs a seat both of its cards in one turn.
						bluffed: "apply-action"
					} )
				];
			}
		},

		/**
		 * One seat choosing which card to turn over, and what becomes of the action
		 * that was in flight when it had to.
		 */
		[ COUP_LOSE_INFLUENCE ]: {
			responseMoves: [ "surrenderInfluence" ],
			timeoutMillis: COUP_CHOICE_TIMEOUT_MILLIS,

			// A seat that will not choose loses the first card it is holding, rather
			// than holding the table up over a decision it has declined to make.
			onTimeout: ( data, open, rng ) => settleLoss( data, open, rng, undefined ),

			resolve: ( data, open, rng ) => settleLoss(
				data,
				open,
				rng,
				open.target ? ( open.responses[ open.target ] as Surrender | undefined )?.card : undefined
			)
		},

		/**
		 * An Ambassador choosing which cards to keep. The seat's own business, so
		 * a single responder and a longer clock than a reaction window gets.
		 */
		[ COUP_EXCHANGE ]: {
			responseMoves: [ "exchangeCards" ],
			timeoutMillis: COUP_CHOICE_TIMEOUT_MILLIS,

			// Declining to choose keeps what the seat already had.
			onTimeout: ( data, open, rng ) => settleExchange( data, open, rng, undefined ),

			resolve: ( data, open, rng ) => settleExchange(
				data,
				open,
				rng,
				open.target ? ( open.responses[ open.target ] as Exchange | undefined )?.keep : undefined
			)
		}
	},

	/**
	 * The bot answers reaction windows as well as taking turns, which is what
	 * keeps a table moving when somebody goes quiet: every window names living
	 * responders, and one that never answers would hold up everyone else.
	 */
	botMove: decideMove
} );


// --- Settlements -----------------------------------------------------------

/**
 * Turns one card face up, and picks the action's story back up where the loss
 * interrupted it.
 *
 * The loss is folded locally before the continuation is worked out, so the tail
 * reasons about the table as it will be rather than as it was. That is what lets
 * an assassination aimed at a seat which has just gone out fizzle instead of
 * asking a player with no cards to give one up.
 */
function settleLoss(
	data: Data,
	open: InteractionFrame,
	rng: ( salt?: string ) => Rng,
	chosen: CharacterCard | undefined
) {
	const loser = open.target;
	const influence = loser ? data.state.playerData[ loser ]?.influence ?? [] : [];

	if ( !loser || influence.length === 0 ) {
		return [];
	}

	const card = chosen !== undefined && holds( influence, chosen ) ? chosen : influence[ 0 ]!;

	// The card is named as it goes and then shuffled back in. Nothing on the table
	// keeps a record of it, so every character stays live for the whole game and a
	// seat cannot be read off what it has already lost.
	const lost = InfluenceLost.make( {
		playerId: loser,
		card,
		deck: returnToDeck( data.state.deck, [ card ], rng( `lost:${ loser }` ) )
	} );

	const eliminated = influence.length === 1;

	const events = [
		lost,
		note( data, loser, `lost the ${ card }`, { card } ),
		...( eliminated
			? [ PlayerEliminated.make( { playerId: loser } ), note( data, loser, "is out" ) ]
			: [] )
	];

	// The table the continuation runs against, with the loss already folded in.
	const after = events.reduce( apply, data.state );
	const next: Data = { ...data, state: after };
	const outcome = ( open.payload ?? "none" ) as LossOutcome;
	const pending = data.state.pending;

	const tail = !pending || outcome === "none"
		? [ PendingCleared.make( {} ) ]
		: outcome === "abort-action"
			? [
				ActionFizzled.make( {
					action: pending.action,
					actor: pending.actor,
					reason: "the claim did not hold"
				} ),
				PendingCleared.make( {} )
			]
			: outcome === "apply-action"
				? applyEffects( next, pending, rng )
				: advance( next, pending, rng );

	return [
		...events,
		...( eliminated
			? [ SeatStatusChanged.make( { playerId: loser, status: "eliminated" } ) ]
			: [] ),
		...tail
	];
}

/**
 * Finishes an exchange: the seat keeps what it named, and everything else goes
 * back into the deck and is shuffled in.
 */
function settleExchange(
	data: Data,
	open: InteractionFrame,
	rng: ( salt?: string ) => Rng,
	chosen: ReadonlyArray<CharacterCard> | undefined
) {
	const actor = open.target;
	const pending = data.state.pending;

	if ( !actor || !pending ) {
		return [];
	}

	const influence = data.state.playerData[ actor ]?.influence ?? [];
	const drawn = data.state.exchangeDraw ?? [];
	const pool = [ ...influence, ...drawn ];

	const kept = chosen !== undefined
		&& chosen.length === influence.length
		&& isSubMultiset( pool, chosen )
		? chosen
		: influence;

	const deck = returnToDeck( data.state.deck, removeEach( pool, kept ), rng( `exchange:${ actor }` ) );

	return [
		ExchangeCompleted.make( { playerId: actor, kept, deck } ),
		ActionResolved.make( { action: pending.action, actor: pending.actor } ),
		PendingCleared.make( {} )
	];
}
