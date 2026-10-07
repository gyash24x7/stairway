import type { CoupCard, CoupState, CoupView } from "@/games/coup/schema";
import { COUP_CARD_COPIES, COUP_CHARACTERS } from "@/games/coup/schema";
import type { GameContext, PlayerId } from "@/swish/schema";


// --- Reading the table -----------------------------------------------------

/** The face-down cards a player still holds. */
export const handOf = ( state: CoupState, playerId: PlayerId ) => state.hands[ playerId ] ?? [];

/** How many influences a player has left. Zero means they are out. */
export const influenceOf = ( state: CoupState, playerId: PlayerId ) =>
	handOf( state, playerId ).length;

/** What a player holds. Absent from `coins` means nothing, not unknown. */
export const coinsOf = ( state: CoupState, playerId: PlayerId ) => state.coins[ playerId ] ?? 0;

/** Whether a player is still in the game. */
export const isAlive = ( state: CoupState, playerId: PlayerId ) =>
	!state.eliminated.includes( playerId );

/** Everyone still in the game, in seat order. */
export const aliveOf = ( state: CoupState, context: GameContext ) =>
	context.players.filter( playerId => isAlive( state, playerId ) );

/**
 * Everyone still in the game apart from one player, in seat order.
 *
 * What a window's `responders` is built from: the table minus whoever is being
 * asked about. A player never answers their own claim, and somebody who is out
 * has no say in anything.
 */
export const aliveOthers = ( state: CoupState, context: GameContext, playerId: PlayerId ) =>
	aliveOf( state, context ).filter( other => other !== playerId );

/** Whether a player actually holds the character they are claiming. */
export const holds = ( state: CoupState, playerId: PlayerId, card: CoupCard ) =>
	handOf( state, playerId ).includes( card );

/** Builds a fresh, unshuffled deck: three of each character. */
export const buildDeck = (): ReadonlyArray<CoupCard> =>
	COUP_CHARACTERS.flatMap( card => Array.from( { length: COUP_CARD_COPIES }, () => card ) );


// --- Card accounting -------------------------------------------------------

/**
 * Removes one copy of a card from a list, leaving any others alone.
 *
 * Hands hold duplicates — two Dukes is a perfectly ordinary hand — so every
 * "give this card up" has to take exactly one of them. A filter would take both.
 *
 * @param cards - The list to take from.
 * @param card - The card to take one of.
 * @returns The list with one copy removed, or the list unchanged if it held none.
 */
export const withoutOne = ( cards: ReadonlyArray<CoupCard>, card: CoupCard ) => {
	const index = cards.indexOf( card );
	return index < 0 ? [ ...cards ] : [ ...cards.slice( 0, index ), ...cards.slice( index + 1 ) ];
};

/**
 * Whether one list of cards can be taken out of another, counting duplicates.
 *
 * What an Exchange is validated against: the cards kept have to come out of the
 * hand and the draw, and a player claiming to keep two Dukes when only one is in
 * front of them is refused rather than handed a second.
 *
 * @param pool - What is actually available.
 * @param taken - What is being taken out of it.
 * @returns `true` when every card taken has a copy left in the pool.
 */
export const isSubMultiset = (
	pool: ReadonlyArray<CoupCard>,
	taken: ReadonlyArray<CoupCard>
) => {
	let left = [ ...pool ];

	for ( const card of taken ) {
		const index = left.indexOf( card );
		if ( index < 0 ) {
			return false;
		}

		left = [ ...left.slice( 0, index ), ...left.slice( index + 1 ) ];
	}

	return true;
};

/**
 * Takes one list out of another, counting duplicates, and returns what is left.
 *
 * The other half of an Exchange: the cards not kept are the ones that go back
 * into the deck.
 *
 * @param pool - What was available.
 * @param taken - What was kept.
 * @returns The remainder.
 */
export const remainderOf = (
	pool: ReadonlyArray<CoupCard>,
	taken: ReadonlyArray<CoupCard>
) => {
	let left = [ ...pool ];

	for ( const card of taken ) {
		left = withoutOne( left, card );
	}

	return left;
};


// --- What a seat can work out ----------------------------------------------

/**
 * How many copies of a character one seat can account for with certainty — the
 * ones actually in front of it, hand and exchange draw together.
 *
 * Its own surrendered cards are deliberately *not* counted. A lost influence goes
 * back into the reshuffled deck rather than face up on the table, so a seat that
 * gave up a Duke has not removed that Duke from the game — it may be in the deck,
 * and it may since have been drawn by the very player now claiming it.
 *
 * That hiding is also why nothing here reads anybody else's losses: there is
 * nothing to read. A seat can be certain of the cards it is holding and of
 * nothing else whatsoever.
 *
 * @param view - The table as that seat sees it.
 * @param card - The character being counted.
 * @returns How many copies that seat can account for.
 */
export const visibleCopies = ( view: CoupView, card: CoupCard ) =>
	[ ...view.hand, ...view.drawn ].filter( held => held === card ).length;

/**
 * Whether a claim is provably a bluff from where one seat is sitting.
 *
 * Genuinely rare now that losses are hidden: it takes holding every copy at once,
 * which needs a hand and a live exchange draw between them. The bot challenges on
 * this and nothing else, so in practice it lets claims stand — that is the cost
 * of a policy that never guesses, in a game where hidden losses leave nothing but
 * guesses to go on.
 *
 * @param view - The table as that seat sees it.
 * @param card - The character being claimed.
 * @returns `true` when that seat is holding every copy there is.
 */
export const isProvableBluff = ( view: CoupView, card: CoupCard ) =>
	visibleCopies( view, card ) >= COUP_CARD_COPIES;

/**
 * How much a seat would rather keep a card, lowest first.
 *
 * Used to decide which influence to give up and which cards to keep out of an
 * Exchange. Rough on purpose: the Contessa only ever saves you from an
 * assassination, the Ambassador only ever moves cards around, and the Duke earns
 * three coins a turn and stops Foreign Aid, so it is the one worth holding.
 */
const CARD_VALUE: Record<CoupCard, number> = {
	AMBASSADOR: 1,
	CONTESSA: 2,
	ASSASSIN: 3,
	CAPTAIN: 4,
	DUKE: 5
};

/**
 * Sorts cards by how much a seat would rather keep them, best first.
 *
 * @param cards - The cards to rank.
 * @returns The same cards, most worth keeping first.
 */
export const byKeepValue = ( cards: ReadonlyArray<CoupCard> ) =>
	[ ...cards ].sort( ( a, b ) => CARD_VALUE[ b ] - CARD_VALUE[ a ] );
