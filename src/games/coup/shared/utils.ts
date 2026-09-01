import {
	COUP_ASSASSINATE_COST,
	COUP_COUP_COST,
	COUP_MANDATORY_COUP_COINS,
	COUP_STEAL_AMOUNT
} from "@/games/coup/shared/schema.ts";

import type {
	ActionKind,
	CharacterCard,
	CoupPublicPlayerData,
	CoupView
} from "@/games/coup/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

/**
 * The rules both sides run.
 *
 * The engine validates against these and the client greys its buttons out with
 * them, so a control is disabled in exactly the cases the command would have
 * been refused. Everything here is a pure function of the *public* view, which
 * is what lets the client run it at all.
 */


// --- What an action is -----------------------------------------------------

/**
 * The character an action asserts, or `undefined` when it asserts none.
 *
 * This is the whole of what makes an action challengeable: `income`,
 * `foreignAid` and `coup` are anybody's to take, so there is nothing to call a
 * bluff on.
 *
 * @param action - The action being taken.
 * @returns The character claimed, or `undefined`.
 */
const CLAIMS: Record<ActionKind, CharacterCard | undefined> = {
	income: undefined,
	foreignAid: undefined,
	coup: undefined,
	tax: "duke",
	assassinate: "assassin",
	steal: "captain",
	exchange: "ambassador"
};

export const claimFor = ( action: ActionKind ) => CLAIMS[ action ];

/**
 * The characters that can stop an action, in the order a client should offer
 * them. Empty means nothing can.
 *
 * @param action - The action being taken.
 * @returns The characters that block it.
 */
const BLOCKERS: Record<ActionKind, ReadonlyArray<CharacterCard>> = {
	income: [],
	foreignAid: [ "duke" ],
	coup: [],
	tax: [],
	assassinate: [ "contessa" ],
	steal: [ "captain", "ambassador" ],
	exchange: []
};

export const blockersFor = ( action: ActionKind ) => BLOCKERS[ action ];

/** Whether a seat may call this action's claim a bluff. */
export const isChallengeable = ( action: ActionKind ) => claimFor( action ) !== undefined;

/** Whether anybody may stop this action by claiming a character of their own. */
export const isBlockable = ( action: ActionKind ) => blockersFor( action ).length > 0;

/** Whether the named character is one that stops this action. */
export const canBlockWith = ( action: ActionKind, card: CharacterCard ) =>
	blockersFor( action ).includes( card );

/**
 * What the action costs, paid the moment it is declared.
 *
 * Both costs are spent up front and neither comes back — an assassination that
 * is challenged down or blocked still cost its three coins. That is the printed
 * rule, and it is what stops a seat probing for a Contessa for free.
 *
 * @param action - The action being taken.
 * @returns The coins it costs.
 */
export const costOf = ( action: ActionKind ) => {
	switch ( action ) {
		case "coup":
			return COUP_COUP_COST;
		case "assassinate":
			return COUP_ASSASSINATE_COST;
		default:
			return 0;
	}
};

/** Whether the action names somebody to aim at. */
export const needsTarget = ( action: ActionKind ) =>
	action === "coup" || action === "assassinate" || action === "steal";

/**
 * Whether a seat on this many coins has run out of choices.
 *
 * At ten a seat must Coup, which is what stops a table stalling behind somebody
 * content to take income forever.
 *
 * @param coins - The seat's treasury at the start of its turn.
 * @returns `true` when Coup is the only legal action.
 */
export const mustCoup = ( coins: number ) => coins >= COUP_MANDATORY_COUP_COINS;


// --- Reading the table -----------------------------------------------------

/** Whether a seat still holds a card, and so is still in the game. */
export const isAlive = ( player: CoupPublicPlayerData | undefined ) =>
	( player?.influenceCount ?? 0 ) > 0;

/**
 * Everyone still holding a card, in seating order.
 *
 * @param view - The view being read.
 * @param order - The seating order, off the game context.
 * @returns The seats still in the game.
 */
export const livingPlayers = (
	view: CoupView,
	order: ReadonlyArray<PlayerId>
) => order.filter( id => isAlive( view.playerData[ id ] ) );

/**
 * Everyone still in the game but the one named.
 *
 * @param view - The view being read.
 * @param order - The seating order, off the game context.
 * @param playerId - The seat to leave out.
 * @returns The other living seats, in seating order.
 */
export const livingOpponents = (
	view: CoupView,
	order: ReadonlyArray<PlayerId>,
	playerId: PlayerId
) => livingPlayers( view, order ).filter( id => id !== playerId );

/**
 * How many copies of a character this audience can account for.
 *
 * Only its own hand, because that is the only place a card is ever *seen*. A
 * card given up is named as it goes and then returns to the deck, so nothing on
 * the table records which characters have been played out and there is no
 * counting a claim down to certainty.
 *
 * What it still tells you is how likely a claim is. Holding two of the three
 * copies leaves exactly one unaccounted for, somewhere among every other hand
 * and the deck — so a claim on it is probably, though never provably, a bluff.
 *
 * @param view - The view being read.
 * @param card - The character being counted.
 * @returns How many of its three copies this audience is holding.
 */
export const visibleCopies = ( view: CoupView, card: CharacterCard ) =>
	view.influence.filter( held => held === card ).length;


// --- What a seat may do ----------------------------------------------------

/**
 * The actions a seat could legally declare right now.
 *
 * Affordability and the ten-coin rule only; whether a *target* exists is the
 * caller's business, since a table always has one while the game is running.
 *
 * @param coins - The seat's treasury.
 * @returns The actions it may take, in the order a client should offer them.
 */
export const legalActions = ( coins: number ) => {
	const forced: ReadonlyArray<ActionKind> = [ "coup" ];
	if ( mustCoup( coins ) ) {
		return forced;
	}

	const actions: Array<ActionKind> = [ "income", "foreignAid", "tax", "steal", "exchange" ];

	if ( coins >= COUP_ASSASSINATE_COST ) {
		actions.push( "assassinate" );
	}

	if ( coins >= COUP_COUP_COST ) {
		actions.push( "coup" );
	}

	return actions;
};

/**
 * What a steal actually moves: two coins, or whatever the target has when that
 * is less. Stealing from an empty treasury is legal and simply takes nothing —
 * the Captain was still played, and can still be challenged for it.
 *
 * @param targetCoins - What the target is holding.
 * @returns The coins that change hands.
 */
export const stealAmount = ( targetCoins: number ) =>
	Math.min( COUP_STEAL_AMOUNT, Math.max( 0, targetCoins ) );
