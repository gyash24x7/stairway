import * as Match from "effect/Match";

import { castDraft, produce } from "immer";

import type { CoupCard } from "@/games/coup/schema";
import {
	ActionCancelled,
	ActionDeclared,
	ActionResolved,
	BlockDeclared,
	CardReplaced,
	CoinsChanged,
	COUP_ASSASSINATE_COST,
	COUP_BOT_DELAY_MILLIS,
	COUP_CHALLENGE_WINDOW_MILLIS,
	COUP_COUP_COST,
	COUP_DECISION_WINDOW_MILLIS,
	COUP_DEFAULT_PLAYERS,
	COUP_EXCHANGE_DRAW,
	COUP_FORCED_COUP_COINS,
	COUP_FOREIGN_AID_COINS,
	COUP_INCOME_COINS,
	COUP_MOVE_TIMEOUT_MILLIS,
	COUP_STARTING_COINS,
	COUP_STARTING_INFLUENCE,
	COUP_STEAL_COINS,
	COUP_TAX_COINS,
	CoupConfig,
	CoupEvent,
	CoupMoveSchemas,
	CoupState,
	CoupView,
	Dealt,
	ExchangeDrawn,
	ExchangeReturned,
	InfluenceLost,
	PlayerEliminated
} from "@/games/coup/schema";
import {
	aliveOf,
	aliveOthers,
	buildDeck,
	byKeepValue,
	coinsOf,
	handOf,
	holds,
	isAlive,
	isProvableBluff,
	isSubMultiset,
	remainderOf,
	withoutOne
} from "@/games/coup/utils";
import type { Rng } from "@/shared/utils/rng";
import { InvalidMove } from "@/swish/errors";
import type { GameData, InteractionFrame, PlayerId } from "@/swish/schema";
import { InteractionOpened, InteractionOption, Standing, Standings } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { activeFrame, firstAnswer, optionsFor, playerIdFor, responseOf } from "@/swish/utils";


type CoupData = GameData<CoupState, CoupConfig>;
type CoupEmitted = ReadonlyArray<CoupEvent | InteractionOpened>;


// --- Window helpers --------------------------------------------------------

const option = ( move: string, players?: ReadonlyArray<PlayerId> ) =>
	InteractionOption.make( { move, players } );

/**
 * Opens the window over a declared claim: everybody still in the game apart from
 * the player who declared it, with whatever objections that particular action
 * admits.
 *
 * The options are always spelled out rather than left to the kind's defaults,
 * because the `claim` kind's declared move list is the union of everything anyone
 * could ever say to any action — offering a Contessa against a Tax would be
 * nonsense.
 */
const claimWindow = (
	data: CoupData,
	actor: PlayerId,
	options: ReadonlyArray<InteractionOption>
) => InteractionOpened.make( {
	kind: "claim",
	initiator: actor,
	responders: aliveOthers( data.state, data.context, actor ),
	options
} );

/**
 * Opens the window that asks one player to give up an influence. Mandatory, and
 * answered by them alone.
 */
const loseInfluenceWindow = ( initiator: PlayerId, subject: PlayerId ) =>
	InteractionOpened.make( {
		kind: "loseInfluence",
		initiator,
		subject,
		responders: [ subject ]
	} );

/**
 * Which character is on trial in a window, and who claimed it.
 *
 * A `claim` window is about the action's own claim; a `blockClaim` window is
 * about the character somebody stood up with to stop it. Both are challenged the
 * same way, which is why there is one `challenge` move and not two.
 */
const onTrial = ( state: CoupState, frame: InteractionFrame ) => {
	const pending = state.pending;
	if ( !pending ) {
		return undefined;
	}

	const claimant = frame.kind === "blockClaim" ? pending.blocker : pending.actor;
	const claim = frame.kind === "blockClaim" ? pending.blockClaim : pending.claim;

	return claimant && claim ? { claimant, claim } : undefined;
};


// --- Rule helpers ----------------------------------------------------------

const refuse = ( move: string, reason: string ) => new InvalidMove( { move, reason } );

/**
 * Whether a player is over the ceiling and may do nothing but Coup. The one hard
 * rule in a game otherwise made of claims nobody has to back up.
 */
const mustCoup = ( data: CoupData, playerId: PlayerId ) =>
	coinsOf( data.state, playerId ) >= COUP_FORCED_COUP_COINS;

const checkFreeToAct = ( data: CoupData, move: string, playerId: PlayerId ) => mustCoup(
	data,
	playerId
)
	? refuse( move, `With ${ COUP_FORCED_COUP_COINS } coins or more you must launch a coup.` )
	: undefined;

const checkTarget = ( data: CoupData, move: string, actor: PlayerId, target: PlayerId ) => {
	if ( target === actor ) {
		return refuse( move, "You cannot target yourself." );
	}

	if ( !data.context.players.includes( target ) ) {
		return refuse( move, "There is nobody at this table by that name." );
	}

	if ( !isAlive( data.state, target ) ) {
		return refuse( move, "That player is already out." );
	}

	return undefined;
};

/**
 * Settles a challenge: the claimant either shows the character or does not.
 *
 * Showing it costs the challenger an influence, and costs the claimant the card —
 * which goes back into the deck and is replaced, so proving a claim tells the
 * table what you held a moment ago and nothing about what you hold now. Failing
 * to show it costs the claimant an influence instead.
 *
 * Either way the loser is asked for a card through a window rather than having
 * one taken: which influence to give up is a real decision, and one that has to
 * be made rather than declined.
 *
 * @returns Whether the claim stood, and the events that settle it.
 */
const settleChallenge = (
	data: CoupData,
	rng: ( salt?: string ) => Rng,
	claimant: PlayerId,
	claim: CoupCard,
	challenger: PlayerId
): { readonly proven: boolean; readonly events: CoupEmitted } => {
	if ( !holds( data.state, claimant, claim ) ) {
		return { proven: false, events: [ loseInfluenceWindow( challenger, claimant ) ] };
	}

	return {
		proven: true,
		events: [
			CardReplaced.make( {
				playerId: claimant,
				card: claim,
				deck: rng( "challenge" ).shuffle( [ ...data.state.deck, claim ] )
			} ),
			loseInfluenceWindow( claimant, challenger )
		]
	};
};

/**
 * The declared action actually happening, once nobody has stopped it.
 *
 * Reached from two directions: a claim window that closed unanswered, and a
 * challenge that the claimant won. Both mean the same thing — the action stands —
 * so both come here.
 *
 * `ActionResolved` clears `pending`, and the windows opened after it do not need
 * it: an assassination's victim is named on the frame, and an exchange reads the
 * cards in front of the player rather than the action that put them there.
 */
const resolveAction = ( data: CoupData ): CoupEmitted => {
	const pending = data.state.pending;
	if ( !pending ) {
		return [];
	}

	const { actor, target } = pending;

	return Match.value( pending.action ).pipe(
		Match.when( "foreignAid", () => [
			CoinsChanged.make( { playerId: actor, delta: COUP_FOREIGN_AID_COINS } ),
			ActionResolved.make( {} )
		] ),

		Match.when( "tax", () => [
			CoinsChanged.make( { playerId: actor, delta: COUP_TAX_COINS } ),
			ActionResolved.make( {} )
		] ),

		// You take what is there. A Captain claimed against somebody with one coin
		// takes one, which is a bad trade but a legal one.
		Match.when( "steal", (): CoupEmitted => {
			if ( !target ) {
				return [ ActionResolved.make( {} ) ];
			}

			const amount = Math.min( COUP_STEAL_COINS, coinsOf( data.state, target ) );
			return [
				CoinsChanged.make( { playerId: target, delta: -amount } ),
				CoinsChanged.make( { playerId: actor, delta: amount } ),
				ActionResolved.make( {} )
			];
		} ),

		Match.when( "assassinate", (): CoupEmitted => target && isAlive( data.state, target )
			? [ ActionResolved.make( {} ), loseInfluenceWindow( actor, target ) ]
			: [ ActionResolved.make( {} ) ] ),

		// The draw is a count, not the cards: a challenge settled earlier in this
		// same commit may already have reshuffled the deck, and the fold is the only
		// thing that knows what is on top of it by the time this lands.
		Match.when( "exchange", (): CoupEmitted => [
			ExchangeDrawn.make( {
				playerId: actor,
				count: Math.min( COUP_EXCHANGE_DRAW, data.state.deck.length )
			} ),
			ActionResolved.make( {} ),
			InteractionOpened.make( {
				kind: "exchange",
				initiator: actor,
				subject: actor,
				responders: [ actor ]
			} )
		] ),

		Match.orElse( (): CoupEmitted => [ ActionResolved.make( {} ) ] )
	);
};


// --- Engine ----------------------------------------------------------------

export const {
	EngineLive: CoupEngineLive,
	Engine: CoupEngine,
	Structure: CoupStructure
} = makeEngine( {
	name: "coup",
	schemas: {
		state: CoupState,
		config: CoupConfig,
		events: CoupEvent,
		view: CoupView,
		moves: CoupMoveSchemas
	},

	defaultConfig: () => CoupConfig.make( {
		playerCount: COUP_DEFAULT_PLAYERS,
		autoStart: true,
		botDelayMillis: COUP_BOT_DELAY_MILLIS,
		moveTimeoutMillis: COUP_MOVE_TIMEOUT_MILLIS
	} ),

	// The deck is shuffled here, at creation, and dealt at `start` — `setup` runs
	// while the table is still empty, so there is nobody to deal to yet.
	setup: ( _config, rng ) => CoupState.make( {
		deck: rng( "deck" ).shuffle( buildDeck() ),
		hands: {},
		lost: {},
		coins: {},
		eliminated: [],
		drawn: {}
	} ),

	apply: ( state, event ) => produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "coup/ev/Dealt", ( e ) => {
				draft.hands = castDraft( e.hands );
				draft.deck = castDraft( e.deck );
			} ),

			// Clamped at zero because the only way to go negative is a bug, and a
			// table that quietly owes coins is harder to spot than one that does not.
			Match.tag( "coup/ev/CoinsChanged", ( e ) => {
				draft.coins[ e.playerId ] = Math.max( 0, ( draft.coins[ e.playerId ] ?? 0 ) + e.delta );
			} ),

			Match.tag( "coup/ev/ActionDeclared", ( e ) => {
				draft.pending = castDraft( {
					_tag: "coup/PendingAction" as const,
					action: e.action,
					actor: e.actor,
					target: e.target,
					claim: e.claim
				} );
			} ),

			Match.tag( "coup/ev/ActionResolved", () => {
				draft.pending = undefined;
			} ),

			Match.tag( "coup/ev/ActionCancelled", () => {
				draft.pending = undefined;
			} ),

			Match.tag( "coup/ev/BlockDeclared", ( e ) => {
				if ( draft.pending ) {
					draft.pending.blocker = e.blocker;
					draft.pending.blockClaim = e.claim;
				}
			} ),

			Match.tag( "coup/ev/InfluenceLost", ( e ) => {
				draft.hands[ e.playerId ] = withoutOne( handOf( draft, e.playerId ), e.card );
				draft.lost[ e.playerId ] = [ ...( draft.lost[ e.playerId ] ?? [] ), e.card ];
				draft.deck = castDraft( e.deck );
			} ),

			// The replacement is drawn here rather than named on the event, so it is
			// always the top of the deck as it stands at this point in the fold.
			Match.tag( "coup/ev/CardReplaced", ( e ) => {
				const [ replacement, ...rest ] = e.deck;
				const hand = withoutOne( handOf( draft, e.playerId ), e.card );

				draft.hands[ e.playerId ] = replacement ? [ ...hand, replacement ] : hand;
				draft.deck = castDraft( rest );
			} ),

			Match.tag( "coup/ev/ExchangeDrawn", ( e ) => {
				draft.drawn[ e.playerId ] = castDraft( draft.deck.slice( 0, e.count ) );
				draft.deck = castDraft( draft.deck.slice( e.count ) );
			} ),

			Match.tag( "coup/ev/ExchangeReturned", ( e ) => {
				draft.hands[ e.playerId ] = castDraft( e.hand );
				draft.drawn[ e.playerId ] = [];
				draft.deck = castDraft( e.deck );
			} ),

			Match.tag( "coup/ev/PlayerEliminated", ( e ) => {
				if ( !draft.eliminated.includes( e.playerId ) ) {
					draft.eliminated.push( e.playerId );
				}
			} ),

			Match.exhaustive
		);
	} ),

	endIf: ( { state, context } ) => aliveOf( state, context ).length <= 1,

	// The order players went out in, read backwards. The last one standing is
	// first, the player knocked out most recently is second, and so on down to
	// whoever went first.
	resolveResults: ( { state, context } ) => {
		const alive = aliveOf( state, context );
		const order = [ ...alive, ...[ ...state.eliminated ].reverse() ];

		return Standings.make( {
			ranking: order.map( ( playerId, index ) => Standing.make( {
				playerId,
				rank: index + 1
			} ) ),
			winner: alive[ 0 ]
		} );
	},

	// Every hidden region is modelled as a count rather than left out, so one view
	// type renders for a player and a spectator alike: `influence` is how many
	// cards somebody is holding, and `hand` is the only thing that differs between
	// one seat's view and another's.
	view: ( { state, context }, audience ) => {
		const playerId = playerIdFor( audience );

		return CoupView.make( {
			playerId,
			hand: playerId ? handOf( state, playerId ) : [],
			drawn: playerId ? state.drawn[ playerId ] ?? [] : [],
			influence: Object.fromEntries(
				context.players.map( seat => [ seat, handOf( state, seat ).length ] )
			),
			lost: playerId ? state.lost[ playerId ] ?? [] : [],
			coins: state.coins,
			eliminated: state.eliminated,
			deckSize: state.deck.length,
			pending: state.pending
		} );
	},

	hooks: {
		/**
		 * Deals the table. The deck was shuffled at creation, so this only has to cut
		 * it into hands — which is why it needs no randomness of its own, and why the
		 * whole deal rides on one event that a replay folds rather than re-rolls.
		 */
		onStart: ( { state, context } ) => {
			const deck = [ ...state.deck ];
			const hands: Record<string, ReadonlyArray<CoupCard>> = {};

			for ( const playerId of context.players ) {
				hands[ playerId ] = deck.splice( 0, COUP_STARTING_INFLUENCE );
			}

			return [
				Dealt.make( { hands, deck } ),
				...context.players.map( playerId => CoinsChanged.make( {
					playerId,
					delta: COUP_STARTING_COINS
				} ) )
			];
		}
	},

	moves: {

		// --- Turn actions ---------------------------------------------------

		income: {
			validate: ( data, playerId ) => checkFreeToAct( data, "income", playerId ),
			execute: ( _data, playerId ) => [
				CoinsChanged.make( { playerId, delta: COUP_INCOME_COINS } )
			]
		},

		/**
		 * Two coins from the treasury. Claims nothing, so nobody can challenge it —
		 * but anybody may stop it by claiming a Duke, which is a claim of their own
		 * and challengeable in turn.
		 */
		foreignAid: {
			validate: ( data, playerId ) => checkFreeToAct( data, "foreignAid", playerId ),
			execute: ( data, playerId ) => [
				ActionDeclared.make( { action: "foreignAid", actor: playerId } ),
				claimWindow( data, playerId, [ option( "blockForeignAid" ) ] )
			]
		},

		/**
		 * Seven coins to take an influence. Claims nothing and blocks nothing: it is
		 * the one action in the game that simply happens, and the only window it
		 * opens is the target choosing which card to give up.
		 */
		coup: {
			validate: ( data, playerId, { target } ) => {
				if ( coinsOf( data.state, playerId ) < COUP_COUP_COST ) {
					return refuse( "coup", `A coup costs ${ COUP_COUP_COST } coins.` );
				}

				return checkTarget( data, "coup", playerId, target );
			},
			execute: ( _data, playerId, { target } ) => [
				CoinsChanged.make( { playerId, delta: -COUP_COUP_COST } ),
				loseInfluenceWindow( playerId, target )
			]
		},

		tax: {
			validate: ( data, playerId ) => checkFreeToAct( data, "tax", playerId ),
			execute: ( data, playerId ) => [
				ActionDeclared.make( { action: "tax", actor: playerId, claim: "DUKE" } ),
				claimWindow( data, playerId, [ option( "challenge" ) ] )
			]
		},

		/**
		 * The window this opens is the one the whole feature exists for: every
		 * opponent may challenge the Assassin, but only the target may claim the
		 * Contessa that stops it. One window, two options, two audiences.
		 *
		 * The coins are spent on declaring it, not on it working. An assassination
		 * that is blocked, or caught as a bluff, still costs three.
		 */
		assassinate: {
			validate: ( data, playerId, { target } ) => {
				const blocked = checkFreeToAct( data, "assassinate", playerId );
				if ( blocked ) {
					return blocked;
				}

				if ( coinsOf( data.state, playerId ) < COUP_ASSASSINATE_COST ) {
					return refuse(
						"assassinate",
						`An assassination costs ${ COUP_ASSASSINATE_COST } coins.`
					);
				}

				return checkTarget( data, "assassinate", playerId, target );
			},
			execute: ( data, playerId, { target } ) => [
				CoinsChanged.make( { playerId, delta: -COUP_ASSASSINATE_COST } ),
				ActionDeclared.make( {
					action: "assassinate",
					actor: playerId,
					target,
					claim: "ASSASSIN"
				} ),
				claimWindow( data, playerId, [
					option( "challenge" ),
					option( "blockAssassination", [ target ] )
				] )
			]
		},

		steal: {
			validate: ( data, playerId, { target } ) => {
				const blocked = checkFreeToAct( data, "steal", playerId );
				if ( blocked ) {
					return blocked;
				}

				const invalid = checkTarget( data, "steal", playerId, target );
				if ( invalid ) {
					return invalid;
				}

				return coinsOf( data.state, target ) === 0
					? refuse( "steal", "That player has nothing to take." )
					: undefined;
			},
			execute: ( data, playerId, { target } ) => [
				ActionDeclared.make( { action: "steal", actor: playerId, target, claim: "CAPTAIN" } ),
				claimWindow( data, playerId, [
					option( "challenge" ),
					option( "blockSteal", [ target ] )
				] )
			]
		},

		exchange: {
			validate: ( data, playerId ) => checkFreeToAct( data, "exchange", playerId ),
			execute: ( data, playerId ) => [
				ActionDeclared.make( { action: "exchange", actor: playerId, claim: "AMBASSADOR" } ),
				claimWindow( data, playerId, [ option( "challenge" ) ] )
			]
		},

		// --- Responses ------------------------------------------------------

		/**
		 * Calling somebody a liar. Emits nothing: what a challenge *means* depends on
		 * who else was racing to make it, so the window settles it — this move only
		 * has to be the thing that wins the race.
		 *
		 * The guard is against a challenge arriving with no window open, which the
		 * engine would otherwise take for an ordinary turn action.
		 */
		challenge: {
			validate: ( data ) => {
				const frame = activeFrame( data.context );
				if ( !frame ) {
					return refuse( "challenge", "There is nothing to challenge." );
				}

				return onTrial( data.state, frame )
					? undefined
					: refuse( "challenge", "Nobody has claimed anything here." );
			},
			execute: () => []
		},

		blockForeignAid: {
			validate: ( data ) => data.state.pending?.action === "foreignAid"
				? undefined
				: refuse( "blockForeignAid", "No foreign aid has been claimed." ),
			execute: ( _data, playerId ) => [
				BlockDeclared.make( { blocker: playerId, claim: "DUKE" } )
			]
		},

		blockAssassination: {
			validate: ( data, playerId ) => {
				const pending = data.state.pending;

				if ( pending?.action !== "assassinate" ) {
					return refuse( "blockAssassination", "Nobody is being assassinated." );
				}

				return pending.target === playerId
					? undefined
					: refuse( "blockAssassination", "Only the target may claim a Contessa." );
			},
			execute: ( _data, playerId ) => [
				BlockDeclared.make( { blocker: playerId, claim: "CONTESSA" } )
			]
		},

		blockSteal: {
			validate: ( data, playerId ) => {
				const pending = data.state.pending;

				if ( pending?.action !== "steal" ) {
					return refuse( "blockSteal", "Nobody is being stolen from." );
				}

				return pending.target === playerId
					? undefined
					: refuse( "blockSteal", "Only the target may block a steal." );
			},
			execute: ( _data, playerId, { claim } ) => [
				BlockDeclared.make( { blocker: playerId, claim } )
			]
		},

		/**
		 * Giving up an influence: the card leaves the hand and goes back into the
		 * reshuffled deck, and nobody but its owner ever learns what it was.
		 * The elimination rides along rather than being worked out afterwards,
		 * because whether this was the last card is only knowable before it is folded.
		 */
		reveal: {
			validate: ( data, playerId, { card } ) => holds( data.state, playerId, card )
				? undefined
				: refuse( "reveal", "You are not holding that card." ),
			execute: ( data, playerId, { card }, rng ): CoupEmitted => {
				const lost = InfluenceLost.make( {
					playerId,
					card,
					deck: rng( "influence" ).shuffle( [ ...data.state.deck, card ] )
				} );

				return handOf( data.state, playerId ).length <= 1
					? [ lost, PlayerEliminated.make( { playerId } ) ]
					: [ lost ];
			}
		},

		/**
		 * Settling an Exchange: keep as many as you started with, out of your hand
		 * and the two you drew, and the rest go back into a reshuffled deck.
		 */
		exchangeReturn: {
			validate: ( data, playerId, { cards } ) => {
				const hand = handOf( data.state, playerId );
				const pool = [ ...hand, ...( data.state.drawn[ playerId ] ?? [] ) ];

				if ( cards.length !== hand.length ) {
					return refuse(
						"exchangeReturn",
						`An exchange keeps exactly ${ hand.length } card(s).`
					);
				}

				return isSubMultiset( pool, cards )
					? undefined
					: refuse( "exchangeReturn", "Those cards are not in front of you." );
			},
			execute: ( data, playerId, { cards }, rng ) => {
				const pool = [
					...handOf( data.state, playerId ),
					...( data.state.drawn[ playerId ] ?? [] )
				];
				const returned = remainderOf( pool, cards );

				return [
					ExchangeReturned.make( {
						playerId,
						hand: cards,
						deck: rng( "exchange" ).shuffle( [ ...data.state.deck, ...returned ] )
					} )
				];
			}
		}
	},

	interactions: {

		/**
		 * The window over a declared action: challenge the claim it rests on, or
		 * stand up with a character that stops it.
		 *
		 * `first` because it is a race — once somebody has objected there is nothing
		 * for the rest of the table to add, and asking anyway would leak how many
		 * others were about to.
		 */
		claim: {
			moves: [ "challenge", "blockForeignAid", "blockAssassination", "blockSteal" ],
			resolution: "first",
			allowPass: true,
			timeoutMillis: COUP_CHALLENGE_WINDOW_MILLIS,
			onResolve: ( data, frame, rng ): CoupEmitted => {
				const pending = data.state.pending;
				if ( !pending ) {
					return [];
				}

				const answer = firstAnswer( frame );

				// Nobody objected — everyone passed, or the clock ran out on them. The
				// ordinary end of a claim window, and where most actions actually happen.
				if ( !answer ) {
					return resolveAction( data );
				}

				if ( answer.move !== "challenge" ) {
					// A block. The blocking move has already recorded the claim it rests
					// on, so the table can now be asked whether it believes *that*.
					return [
						InteractionOpened.make( {
							kind: "blockClaim",
							initiator: answer.playerId,
							subject: pending.actor,
							responders: aliveOthers( data.state, data.context, answer.playerId ),
							options: [ option( "challenge" ) ]
						} )
					];
				}

				const trial = onTrial( data.state, frame );
				if ( !trial ) {
					return resolveAction( data );
				}

				const settled = settleChallenge(
					data,
					rng,
					trial.claimant,
					trial.claim,
					answer.playerId
				);

				return settled.proven
					? [ ...settled.events, ...resolveAction( data ) ]
					: [ ...settled.events, ActionCancelled.make( {} ) ];
			}
		},

		/**
		 * The window over a block: does the table believe the character that was
		 * stood up to stop the action?
		 *
		 * Opened from inside the `claim` window's own resolution, which is the whole
		 * reason the engine keeps a stack. Nobody challenging means the block stands
		 * and the action is thrown out; a successful challenge means the blocker was
		 * bluffing and the action goes through after all.
		 */
		blockClaim: {
			moves: [ "challenge" ],
			resolution: "first",
			allowPass: true,
			timeoutMillis: COUP_CHALLENGE_WINDOW_MILLIS,
			onResolve: ( data, frame, rng ): CoupEmitted => {
				const trial = onTrial( data.state, frame );
				if ( !trial ) {
					return [ ActionCancelled.make( {} ) ];
				}

				const answer = firstAnswer( frame );
				if ( !answer ) {
					return [ ActionCancelled.make( {} ) ];
				}

				const settled = settleChallenge(
					data,
					rng,
					trial.claimant,
					trial.claim,
					answer.playerId
				);

				return settled.proven
					? [ ...settled.events, ActionCancelled.make( {} ) ]
					: [ ...settled.events, ...resolveAction( data ) ];
			}
		},

		/**
		 * Somebody has to give up a card. Mandatory, so the engine will not take
		 * silence for an answer: if the clock runs out it asks the bot policy, and
		 * only if that has nothing to say does this step in and take the leftmost
		 * card.
		 *
		 * `all` rather than `first` so the same window can ask two players at once —
		 * which is what a challenge lost against an assassination comes to.
		 *
		 * Answered responders are skipped: the `reveal` move has already turned their
		 * card over. A player with nothing left is skipped too, which is how the one
		 * genuinely awkward case in Coup lands softly — a challenger who is also the
		 * assassination's target loses their second card to the challenge and has
		 * none left for the assassination.
		 */
		loseInfluence: {
			moves: [ "reveal" ],
			resolution: "all",
			allowPass: false,
			timeoutMillis: COUP_DECISION_WINDOW_MILLIS,
			onResolve: ( data, frame, rng ): CoupEmitted => {
				const events: Array<CoupEvent> = [];

				// Threaded rather than read from `data.state` each time: every loss puts
				// a card back, so the pile the next one reshuffles has to be the pile
				// the previous one left. The window has one responder today, but a
				// second would otherwise silently drop the first card it returned.
				let deck = [ ...data.state.deck ];

				for ( const playerId of frame.responders ) {
					if ( responseOf( frame, playerId )?.outcome === "answered" ) {
						continue;
					}

					const hand = handOf( data.state, playerId );
					const card = hand[ 0 ];
					if ( !card ) {
						continue;
					}

					deck = rng( `influence-${ playerId }` ).shuffle( [ ...deck, card ] );
					events.push( InfluenceLost.make( { playerId, card, deck } ) );

					if ( hand.length <= 1 ) {
						events.push( PlayerEliminated.make( { playerId } ) );
					}
				}

				return events;
			}
		},

		/**
		 * The player who called for an Exchange choosing what to keep.
		 *
		 * Mandatory, and modelled as a window rather than as a second turn: the cards
		 * are already in front of them, the table is waiting, and nothing about it
		 * belongs to anybody else. A player who walks away simply keeps what they had
		 * and the draw goes back.
		 */
		exchange: {
			moves: [ "exchangeReturn" ],
			resolution: "all",
			allowPass: false,
			timeoutMillis: COUP_DECISION_WINDOW_MILLIS,
			onResolve: ( data, frame, rng ): CoupEmitted => {
				const playerId = frame.responders[ 0 ];
				if ( !playerId ) {
					return [];
				}

				const drawn = data.state.drawn[ playerId ] ?? [];
				if ( drawn.length === 0 ) {
					return [];
				}

				return [
					ExchangeReturned.make( {
						playerId,
						hand: handOf( data.state, playerId ),
						deck: rng( "exchange" ).shuffle( [ ...data.state.deck, ...drawn ] )
					} )
				];
			}
		}
	},

	/**
	 * The turn passes to the next seat still in the game.
	 *
	 * The default round-robin will not do here: it would hand the turn to a player
	 * who has been knocked out and leave the table waiting on somebody who has
	 * nothing to play.
	 */
	resolveNextPlayer: ( { state, context }, playerId ) => {
		const order = context.players;
		const from = order.indexOf( playerId );

		for ( let step = 1; step <= order.length; step++ ) {
			const candidate = order[ ( from + step ) % order.length ];
			if ( candidate && isAlive( state, candidate ) ) {
				return candidate;
			}
		}

		return playerId;
	},

	/**
	 * How a machine-played seat takes its turn.
	 *
	 * Deliberately plain, and deliberately a bluffer: it claims whatever the moment
	 * calls for and worries about being caught later, because a bot that only ever
	 * claimed what it held would be readable in two turns and the game would stop
	 * being about anything.
	 *
	 * The one rule here that is not about playing well is `pressing`, and it is
	 * about the game ending at all. A policy is pure in the position and remembers
	 * nothing, so a bot whose Steal was blocked will offer exactly the same Steal
	 * next turn, and the turn after that. Two Captains at the same table lock into
	 * it: each robs the other, each blocks, neither can prove the other is bluffing,
	 * and the table plays out the same turn forever with nothing changing.
	 *
	 * Banking on alternate turns breaks it, because Income cannot be stopped by
	 * anybody. Coins climb by at least one every two turns whatever the table does,
	 * so every seat reaches seven, and a Coup cannot be blocked or challenged —
	 * which makes a coup, and therefore an ending, unavoidable.
	 */
	botMove: ( { state, context } ) => {
		const me = state.playerId;
		if ( !me ) {
			return undefined;
		}

		const coins = state.coins[ me ] ?? 0;

		// The richest opponent still standing: the one closest to affording a coup,
		// and the one worth taking coins off.
		const target = Object.keys( state.influence )
			.map( seat => seat as PlayerId )
			.filter( seat => seat !== me && !state.eliminated.includes( seat ) )
			.sort( ( a, b ) => ( state.coins[ b ] ?? 0 ) - ( state.coins[ a ] ?? 0 ) )[ 0 ];

		if ( target && coins >= COUP_COUP_COST ) {
			return { moveType: "coup" as const, input: { target } };
		}

		// Whether to try something the table can stop this turn, or simply bank.
		const pressing = context.turn % 2 === 0;

		if (
			pressing
			&& target
			&& coins >= COUP_ASSASSINATE_COST
			&& state.hand.includes( "ASSASSIN" )
		) {
			return { moveType: "assassinate" as const, input: { target } };
		}

		if (
			pressing
			&& target
			&& ( state.coins[ target ] ?? 0 ) > 0
			&& state.hand.includes( "CAPTAIN" )
		) {
			return { moveType: "steal" as const, input: { target } };
		}

		// Tax and Exchange are challengeable but not blockable, and a bot only
		// challenges a claim it can prove impossible — so holding the card means
		// these land, and they need no banking turn between them.
		if ( state.hand.includes( "DUKE" ) ) {
			return { moveType: "tax" as const, input: {} };
		}

		if ( state.hand.includes( "AMBASSADOR" ) && state.deckSize > 0 ) {
			return { moveType: "exchange" as const, input: {} };
		}

		return { moveType: "income" as const, input: {} };
	},

	/**
	 * How a machine-played seat answers an open window.
	 *
	 * Three different jobs, told apart by what the window is offering it. A decision
	 * that has to be made is made; a block is claimed only when the card is actually
	 * in hand, since a bluffed block invites a challenge it cannot survive; and a
	 * challenge is thrown only when the claim is impossible as a matter of
	 * arithmetic — every copy of the character is in its own hand. Losses are
	 * hidden and go back into the deck, so that is all there is to be certain of.
	 *
	 * Returning `undefined` is how it declines, which the engine records as a pass
	 * on a window that allows one.
	 */
	botRespond: ( { state }, frame ) => {
		const me = state.playerId;
		if ( !me ) {
			return undefined;
		}

		const options = optionsFor( frame, me );

		if ( options.includes( "reveal" ) ) {
			const giveUp = byKeepValue( state.hand ).at( -1 );
			return giveUp ? { moveType: "reveal" as const, input: { card: giveUp } } : undefined;
		}

		if ( options.includes( "exchangeReturn" ) ) {
			const keep = byKeepValue( [ ...state.hand, ...state.drawn ] ).slice( 0, state.hand.length );
			return { moveType: "exchangeReturn" as const, input: { cards: keep } };
		}

		if ( options.includes( "blockAssassination" ) && state.hand.includes( "CONTESSA" ) ) {
			return { moveType: "blockAssassination" as const, input: {} };
		}

		if ( options.includes( "blockSteal" ) ) {
			const claim = state.hand.find( card => card === "CAPTAIN" || card === "AMBASSADOR" );
			if ( claim === "CAPTAIN" || claim === "AMBASSADOR" ) {
				return { moveType: "blockSteal" as const, input: { claim } };
			}
		}

		if ( options.includes( "blockForeignAid" ) && state.hand.includes( "DUKE" ) ) {
			return { moveType: "blockForeignAid" as const, input: {} };
		}

		if ( options.includes( "challenge" ) ) {
			const pending = state.pending;
			const claim = frame.kind === "blockClaim" ? pending?.blockClaim : pending?.claim;

			if ( claim && isProvableBluff( state, claim ) ) {
				return { moveType: "challenge" as const, input: {} };
			}
		}

		return undefined;
	}
} );
