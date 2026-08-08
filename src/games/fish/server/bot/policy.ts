import { type Beliefs, buildBeliefs, probability } from "@/games/fish/server/bot/beliefs.ts";
import {
	bestSnatch,
	opponentRisk,
	type Snatch,
	snatchScore
} from "@/games/fish/server/bot/snatch.ts";
import type { Book, FishConfig, FishPlayerView, FishSnapshot } from "@/games/fish/shared/schema.ts";
import { getBookForCard, getCardsOfBook, getTeammates } from "@/games/fish/shared/utils.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";

// --- The policy -------------------------------------------------------------
// A flat priority list over the belief model. The one thing worth understanding
// before reading it: a successful claim is the ONLY way to hand the turn to a
// chosen teammate, so a book the team provably holds is not a point to bank —
// it is a stored turn-teleport. Nobody can take it off us (asking in a book
// requires holding one of its cards, and we hold them all), so we sit on it
// until a teammate is better placed to act, then cash it and pass them the turn.

/**
 * How much better a teammate's prospects must be before the bot spends a banked
 * claim to hand them the turn. Hysteresis, so a marginal difference does not
 * burn the bank. The only tuned number in the policy.
 */
const HOLD_MARGIN = 1.25;


/**
 * Pick the bot's move for a snapshot.
 *
 * @param snapshot - The acting bot's snapshot, its own audience.
 * @returns The move to submit, or `undefined` when there is nothing legal left.
 * @public
 */
export function decideFishMove( snapshot: FishSnapshot ) {
	if ( snapshot.view._tag !== "fish/PlayerView" ) {
		return undefined;
	}

	if ( snapshot.context.phase !== "PLAY" ) {
		return createTeams( snapshot );
	}

	const view = snapshot.view;
	const beliefs = buildBeliefs( view, snapshot.config );
	const teammates = getTeammates( view.teams, view.playerId );

	// 1. Straight after our own successful claim, a transfer is the only legal
	//    move — and the whole point of having claimed. Hand it to whoever is best
	//    placed; card counts here are already post-claim.
	if ( justClaimed( view, snapshot.context.currentPlayer ) ) {
		const target = bestTeammate( beliefs, view, teammates );
		if ( target ) {
			return { moveType: "transferTurn" as const, input: { transferTo: target } };
		}
	}

	const banked = bankedBooks( beliefs, view, teammates );
	const active = activeBook( view, snapshot.config );

	// Whoever we ask gets the turn if we are wrong, so price that in first.
	const risks = opponentRisk( beliefs, view );
	const ask = stayOnBook(
		beliefs,
		view,
		active,
		bestSnatch( beliefs, view, view.playerId, undefined, risks ),
		risks
	);

	// 2. Spend a banked book, if this is the moment for it.
	const cashIn = chooseCashIn( beliefs, view, teammates, banked, ask );
	if ( cashIn ) {
		return { moveType: "claimBook" as const, input: { claim: provenClaim( beliefs, cashIn ) } };
	}

	// 3. Otherwise keep working.
	if ( ask ) {
		return { moveType: "askCard" as const, input: { from: ask.from, cardId: ask.cardId } };
	}

	// 4. No ask and nothing banked: every card of every book we hold is already
	//    with our own team, so claim the book we hold most of and guess the rest
	//    among teammates. Bounded, and the only move left.
	return forcedClaim( beliefs, view, teammates );
}

/**
 * The book the bot is part-way through collecting: whichever it asked in most
 * recently, whether or not that ask landed and whether or not it has held the
 * turn since.
 *
 * Deliberately not scoped to the current run. Most of the bot's book-hopping
 * came from losing the turn and then re-picking from scratch when it came back
 * — which is precisely where a human player would carry on where they left off,
 * and precisely what makes a bot hard to follow.
 */
function activeBook( view: FishPlayerView, config: FishConfig ) {
	const last = view.askHistory.find( ask => ask.playerId === view.playerId );
	return last ? getBookForCard( last.cardId, config.type ) : undefined;
}

/**
 * Prefer carrying on with the active book. The bot only walks away for a book
 * that is *closer to closing* — never merely for better odds,
 * which is the trade that made it hop about. Losing the turn on a long shot at
 * the last card of a book is a better deal than a safe ask that finishes
 * nothing, and it is the version a human at the table can actually follow.
 */
function stayOnBook(
	beliefs: Beliefs,
	view: FishPlayerView,
	book: Book | undefined,
	best: Snatch | undefined,
	risks: ReadonlyMap<PlayerId, number>
) {
	if ( !best ) {
		return undefined;
	}

	if ( !book || book === best.book ) {
		return best;
	}

	const staying = bestSnatch( beliefs, view, view.playerId, book, risks );
	if ( !staying ) {
		// Nothing left to ask for in that book — moving on is the whole point.
		return best;
	}

	return best.outstanding < staying.outstanding - 1e-9 ? best : staying;
}

/** Whether the previous move was this bot's own successful claim. */
function justClaimed( view: FishPlayerView, currentPlayer: PlayerId ) {
	return view.lastMoveType === "claim"
		&& view.claimHistory[ 0 ]?.success === true
		&& view.claimHistory[ 0 ]?.playerId === currentPlayer;
}

/** The teammate with cards and the best prospects, if there is one. */
function bestTeammate( beliefs: Beliefs, view: FishPlayerView, teammates: readonly PlayerId[] ) {
	let best: { pid: PlayerId; score: number } | undefined;

	for ( const pid of teammates ) {
		if ( ( view.cardCounts[ pid ] ?? 0 ) <= 0 ) {
			continue;
		}

		const score = snatchScore( beliefs, view, pid );
		if ( !best || score > best.score ) {
			best = { pid, score };
		}
	}

	return best?.pid;
}

/**
 * Books the bot can prove its own team holds in full, *and* holds a card of
 * itself — both `askCard` and `claimBook` require being in the book, so a book
 * sitting entirely in a teammate's hand is theirs to call, not ours.
 *
 * Completely safe to sit on. Nobody outside the team can ask in the book, and
 * since the same rule governs claiming, nobody outside the team can call it
 * either. A banked book cannot be taken; it can only be given away by claiming
 * it wrong.
 */
function bankedBooks( beliefs: Beliefs, view: FishPlayerView, teammates: readonly PlayerId[] ) {
	const ours = new Set<PlayerId>( [ view.playerId, ...teammates ] );

	return beliefs.liveBooks.filter( book => {
		const cards = beliefs.cardsOf.get( book ) ?? [];
		if ( cards.length !== getCardsOfBook( book ).length ) {
			return false;
		}

		if ( !cards.some( card => view.hand.includes( card ) ) ) {
			return false;
		}

		return cards.every( card => {
			const owner = beliefs.owner.get( card );
			return owner !== undefined && ours.has( owner );
		} );
	} );
}

/**
 * Which banked book to cash now, if any. Two reasons to spend one; absent both,
 * the bank keeps its value by staying unspent.
 *
 * There is deliberately no "cash it before someone steals it" case. Claiming a
 * book requires holding one of its cards, and a banked book has none outside the
 * team — so it cannot be taken, however obvious its whereabouts have become.
 */
function chooseCashIn(
	beliefs: Beliefs,
	view: FishPlayerView,
	teammates: readonly PlayerId[],
	banked: readonly Book[],
	ask: Snatch | undefined
) {
	if ( banked.length === 0 ) {
		return undefined;
	}

	// a. No ask left, or every remaining book is already ours — nobody can move
	//    the game on. Cash in; this is what keeps the game terminating.
	const bankedSet = new Set( banked );
	if ( !ask || beliefs.liveBooks.every( book => bankedSet.has( book ) ) ) {
		return cheapest( beliefs, view, banked );
	}

	// b. The handoff. A teammate is better placed than we are, so buy them the
	//    turn — but only with a book whose claim leaves them holding cards, or
	//    the transfer that follows would not be legal.
	for ( const pid of teammates ) {
		if ( ( view.cardCounts[ pid ] ?? 0 ) <= 0 ) {
			continue;
		}

		if ( snatchScore( beliefs, view, pid ) <= ask.score * HOLD_MARGIN ) {
			continue;
		}

		const usable = banked.filter( book => cardsHeldIn( beliefs, book, pid ) < view.cardCounts[ pid ]! );
		if ( usable.length > 0 ) {
			return cheapest( beliefs, view, usable );
		}
	}

	return undefined;
}

/** How many of a book's cards are proven to be in a player's hand. */
function cardsHeldIn( beliefs: Beliefs, book: Book, playerId: PlayerId ) {
	const cards = beliefs.cardsOf.get( book ) ?? [];
	return cards.filter( card => beliefs.owner.get( card ) === playerId ).length;
}

/** The banked book that costs the bot the fewest cards from its own hand. */
function cheapest( beliefs: Beliefs, view: FishPlayerView, banked: readonly Book[] ) {
	return banked.toSorted( ( a, b ) => {
		const cost = cardsHeldIn( beliefs, a, view.playerId ) - cardsHeldIn( beliefs, b, view.playerId );
		return cost !== 0 ? cost : a.localeCompare( b );
	} )[ 0 ];
}

/** The claim for a book every one of whose holders is proven. */
function provenClaim( beliefs: Beliefs, book: Book ) {
	const claim: Record<string, PlayerId> = {};
	for ( const card of getCardsOfBook( book ) ) {
		claim[ card ] = beliefs.owner.get( card )!;
	}

	return claim;
}

/**
 * The last resort: no ask, nothing proven. Every remaining card of the books we
 * hold is with our own team, so claim the book we hold most of and give each
 * unproven card to the teammate most likely to have it.
 */
function forcedClaim( beliefs: Beliefs, view: FishPlayerView, teammates: readonly PlayerId[] ) {
	const ours = [ view.playerId, ...teammates ];
	// Only a book we are in — `claimBook` requires holding one of its cards. Any
	// player still holding a card is in that card's book, so this is empty only
	// when the bot has no cards at all, and then it has no legal move to make.
	const books = beliefs.liveBooks
		.filter( book => ( beliefs.cardsOf.get( book ) ?? [] ).some( c => view.hand.includes( c ) ) )
		.toSorted( ( a, b ) => {
			const held = cardsHeldIn( beliefs, b, view.playerId ) - cardsHeldIn( beliefs, a, view.playerId );
			return held !== 0 ? held : a.localeCompare( b );
		} );

	const book = books[ 0 ];
	if ( !book ) {
		return undefined;
	}

	const claim: Record<string, PlayerId> = {};
	for ( const card of getCardsOfBook( book ) ) {
		claim[ card ] = beliefs.owner.get( card ) ?? likeliestOf( beliefs, card, ours );
	}

	return { moveType: "claimBook" as const, input: { claim } };
}

/** Whichever of `players` is most likely to hold the card. */
function likeliestOf( beliefs: Beliefs, card: CardId, players: readonly PlayerId[] ) {
	let best = players[ 0 ]!;
	let bestProb = -1;

	for ( const pid of players ) {
		const p = probability( beliefs, card, pid );
		if ( p > bestProb ) {
			best = pid;
			bestProb = p;
		}
	}

	return best;
}

/** TEAM_CONFIG: divide the seated players evenly into `teamCount` teams. */
function createTeams( snapshot: FishSnapshot ) {
	const players = Object.keys( snapshot.players ) as PlayerId[];
	const teamCount = snapshot.config.teamCount;
	const perTeam = players.length / teamCount;
	const teams: Record<string, PlayerId[]> = {};

	for ( let t = 0; t < teamCount; t++ ) {
		teams[ `Team ${ t + 1 }` ] = players.slice( t * perTeam, ( t + 1 ) * perTeam );
	}

	return { moveType: "createTeams" as const, input: { teams } };
}
