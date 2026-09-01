import {
	COUP_ASSASSINATE_COST,
	COUP_BLOCK_ACTION,
	COUP_CHALLENGE_ACTION,
	COUP_CHALLENGE_BLOCK,
	COUP_COPIES_PER_CHARACTER,
	COUP_COUP_COST,
	COUP_EXCHANGE,
	COUP_LOSE_INFLUENCE
} from "@/games/coup/shared/schema.ts";
import {
	blockersFor,
	isAlive,
	livingOpponents,
	mustCoup,
	visibleCopies
} from "@/games/coup/shared/utils.ts";
import { hashSeed, makeRng } from "@/shared/utils/rng.ts";

import type {
	ActionKind,
	CharacterCard,
	CoupConfig,
	CoupView
} from "@/games/coup/shared/schema.ts";
import type { GameContext, GameData, PlayerId } from "@/swish/shared/schema.ts";

/**
 * The bot policy.
 *
 * It is handed the same redacted view its seat's own client gets, so it never
 * knows more than the player it is standing in for — no peeking at the deck, and
 * no reading anybody's hand. Its own two cards are the whole of its evidence,
 * since a card given up rejoins the deck and leaves nothing behind to count.
 *
 * It bluffs. A Coup bot that only ever claimed what it held would be readable
 * after one turn and would lose to anybody paying attention, so the policy
 * treats a claim it cannot back as a priced risk rather than something to avoid.
 */

type Data = GameData<CoupView, CoupConfig>;

/**
 * How much the bot would rather keep a card than give it up.
 *
 * The Duke pays every turn and cannot be blocked, so it goes last. The Contessa
 * is worth holding for what it stops rather than what it does. The Ambassador is
 * the one whose job is mostly done once it has been used.
 */
const KEEP_ORDER: Record<CharacterCard, number> = {
	duke: 5,
	contessa: 4,
	captain: 3,
	assassin: 2,
	ambassador: 1
};

/**
 * A deterministic coin the bot flips.
 *
 * Derived from the seat and the turn rather than taken from the ambient random,
 * so a table plays out the same way twice and a test can pin the policy down.
 * The move it produces is recorded as an event either way, so this is only ever
 * about reproducibility, never about correctness.
 */
const chance = ( context: GameContext, me: PlayerId, label: string ) =>
	makeRng( hashSeed( me, context.turn, label ) ).next();

/** The seat this policy is playing for. */
const meIn = ( data: Data ) => data.state.playerId;

/**
 * Whether the bot is holding enough of a character to doubt somebody else
 * claiming it.
 *
 * Never certainty: a card given up returns to the deck, so no claim is ever
 * provably a bluff from where anyone is sitting. Holding two of the three copies
 * is as close as the game gets — one is left, somewhere among every other hand
 * and the deck.
 */
const mostlyAccountedFor = ( view: CoupView, card: CharacterCard ) =>
	visibleCopies( view, card ) >= COUP_COPIES_PER_CHARACTER - 1;

/**
 * How likely the bot is to call a claim.
 *
 * Its own hand is the whole of its evidence. Holding two copies leaves one
 * unaccounted for and makes the claim a poor bet for the claimant; holding one
 * shortens the odds a little; holding none says nothing at all, and calling on
 * nothing is how a bot talks itself out of the game.
 */
const challengeOdds = ( view: CoupView, card: CharacterCard ) => {
	const mine = visibleCopies( view, card );

	return mine >= 2 ? 0.65 : mine === 1 ? 0.22 : 0.08;
};

/** The opponent most worth removing: the healthiest, then the richest. */
const biggestThreat = ( data: Data, me: PlayerId ) => {
	const opponents = livingOpponents( data.state, data.context.players, me );

	return [ ...opponents ].sort( ( left, right ) => {
		const l = data.state.playerData[ left ];
		const r = data.state.playerData[ right ];

		return ( r?.influenceCount ?? 0 ) - ( l?.influenceCount ?? 0 )
			|| ( r?.coins ?? 0 ) - ( l?.coins ?? 0 );
	} )[ 0 ];
};

/** The opponent worth robbing: whoever is holding the most. */
const richestOpponent = ( data: Data, me: PlayerId ) => {
	const opponents = livingOpponents( data.state, data.context.players, me )
		.filter( id => ( data.state.playerData[ id ]?.coins ?? 0 ) > 0 );

	return [ ...opponents ].sort(
		( left, right ) =>
			( data.state.playerData[ right ]?.coins ?? 0 )
			- ( data.state.playerData[ left ]?.coins ?? 0 )
	)[ 0 ];
};

/** An opponent on their last card, who a coup would finish outright. */
const finishable = ( data: Data, me: PlayerId ) =>
	livingOpponents( data.state, data.context.players, me )
		.find( id => data.state.playerData[ id ]?.influenceCount === 1 );


// --- Choosing a turn -------------------------------------------------------

/**
 * What to do on the bot's own turn.
 *
 * Honest play first, wherever the hand supports it — a real Duke beats a bluffed
 * one because nobody can take it away. Where it does not, the bot claims
 * something anyway rather than shuffling income back and forth: a claim nobody
 * can see through is worth more than the small chance of being called.
 */
const decideTurn = ( data: Data, me: PlayerId ) => {
	const view = data.state;
	const hand = view.influence;
	const coins = view.playerData[ me ]?.coins ?? 0;
	const holding = ( card: CharacterCard ) => hand.includes( card );

	const threat = biggestThreat( data, me );
	const wounded = finishable( data, me );

	// Forced, and worth doing early anyway when it ends somebody.
	if ( mustCoup( coins ) || ( coins >= COUP_COUP_COST && wounded !== undefined ) ) {
		const target = wounded ?? threat;
		return target === undefined
			? undefined
			: { moveType: "coup" as const, target };
	}

	// Affordable and decisive. Sitting on seven waiting for a better moment mostly
	// means somebody else spends theirs first.
	if ( coins >= COUP_COUP_COST && threat !== undefined ) {
		return { moveType: "coup" as const, target: threat };
	}

	if ( holding( "assassin" ) && coins >= COUP_ASSASSINATE_COST ) {
		const target = wounded ?? threat;
		if ( target !== undefined ) {
			return { moveType: "assassinate" as const, target };
		}
	}

	if ( holding( "duke" ) ) {
		return { moveType: "tax" as const };
	}

	// Robbing is zero-sum across the table, so a seat that only ever robs never
	// gets any closer to a coup — and two Captains robbing each other turn about
	// never get anywhere at all, which is a game that does not end. Taking it
	// most of the time keeps the Captain worth holding while leaving room for the
	// actions that actually grow a pile.
	if ( holding( "captain" ) && chance( data.context, me, "rob" ) < 0.7 ) {
		const target = richestOpponent( data, me );
		if ( target !== undefined ) {
			return { moveType: "steal" as const, target };
		}
	}

	// Nothing in hand is paying, so claim the Duke — the best of the bluffs, since
	// no character stops a tax. Held back when the bot has two of them itself and
	// the claim would be a poor bet.
	if ( !mostlyAccountedFor( view, "duke" ) && chance( data.context, me, "bluff" ) < 0.55 ) {
		return { moveType: "tax" as const };
	}

	if ( holding( "ambassador" ) ) {
		return { moveType: "exchange" as const };
	}

	// A hand worth trading in, and a claim that cannot be blocked once it stands.
	if ( !mostlyAccountedFor( view, "ambassador" ) && chance( data.context, me, "swap" ) < 0.4 ) {
		return { moveType: "exchange" as const };
	}

	// Worth twice income and claims nothing, so there is no bluff to be caught in
	// — only a Duke can stop it, and a table that has to spend one to do so has
	// told you something. This is also the policy's floor on progress: it adds to
	// the table rather than moving coins around it, so a game always creeps
	// towards somebody being able to afford a coup.
	if ( chance( data.context, me, "aid" ) < 0.6 ) {
		return { moveType: "foreignAid" as const };
	}

	return { moveType: "income" as const };
};


// --- Answering a window ----------------------------------------------------

/** Whether to call the claim on the table. */
const decideChallenge = ( data: Data, me: PlayerId, claim: CharacterCard | undefined ) => {
	if ( claim === undefined ) {
		return { challenge: false };
	}

	return {
		challenge: chance( data.context, me, `challenge:${ claim }` )
			< challengeOdds( data.state, claim )
	};
};

/**
 * Whether to stop the action, and as what.
 *
 * An honest block is free, so it is always played. A bluffed one is not, and the
 * bot only reaches for it when the alternative is worse than being caught —
 * which, facing an assassination on its last card, it always is.
 */
const decideBlock = ( data: Data, me: PlayerId, action: ActionKind | undefined ) => {
	if ( action === undefined ) {
		return { block: null };
	}

	const hand = data.state.influence;
	const honest = blockersFor( action ).find( card => hand.includes( card ) );

	if ( honest !== undefined ) {
		return { block: honest };
	}

	const cornered = action === "assassinate"
		&& ( data.state.playerData[ me ]?.influenceCount ?? 0 ) <= 1;

	if ( cornered ) {
		// Being caught costs the card the assassination was going to take anyway.
		return { block: "contessa" as const };
	}

	const bluffable = blockersFor( action )
		.find( card => !mostlyAccountedFor( data.state, card ) );

	return bluffable !== undefined && chance( data.context, me, `block:${ action }` ) < 0.25
		? { block: bluffable }
		: { block: null };
};

/** Which card to turn over: the one the bot would miss least. */
const decideSurrender = ( data: Data ) => {
	const hand = [ ...data.state.influence ]
		.sort( ( left, right ) => KEEP_ORDER[ left ] - KEEP_ORDER[ right ] );

	return hand[ 0 ] === undefined ? undefined : { card: hand[ 0 ] };
};

/** Which cards to keep out of an exchange: the most useful, however they arrived. */
const decideExchange = ( data: Data ) => {
	const keeping = data.state.influence.length;
	const pool = [ ...data.state.influence, ...( data.state.exchangeDraw ?? [] ) ];

	return {
		keep: [ ...pool ]
			.sort( ( left, right ) => KEEP_ORDER[ right ] - KEEP_ORDER[ left ] )
			.slice( 0, keeping )
	};
};


// --- The policy ------------------------------------------------------------

/**
 * Decides the bot's move: the answer to whatever window is open when there is
 * one, and otherwise a turn.
 *
 * @param data - The seat's own view of the game.
 * @returns The move to submit, or `undefined` when there is nothing to play.
 */
export const decideMove = ( data: Data ) => {
	const me = meIn( data );
	if ( me === undefined || !isAlive( data.state.playerData[ me ] ) ) {
		return undefined;
	}

	const open = data.context.interactions.slice( -1 )[ 0 ];
	const pending = data.state.pending;

	if ( open !== undefined ) {
		switch ( open.kind ) {
			case COUP_CHALLENGE_ACTION:
				return {
					moveType: "challenge" as const,
					input: decideChallenge( data, me, pending?.claim )
				};

			case COUP_CHALLENGE_BLOCK:
				return {
					moveType: "challenge" as const,
					input: decideChallenge( data, me, pending?.block?.card )
				};

			case COUP_BLOCK_ACTION:
				return {
					moveType: "block" as const,
					input: decideBlock( data, me, pending?.action )
				};

			case COUP_LOSE_INFLUENCE: {
				const surrender = decideSurrender( data );
				return surrender === undefined
					? undefined
					: { moveType: "surrenderInfluence" as const, input: surrender };
			}

			case COUP_EXCHANGE:
				return { moveType: "exchangeCards" as const, input: decideExchange( data ) };

			default:
				return undefined;
		}
	}

	const turn = decideTurn( data, me );

	if ( turn === undefined ) {
		return undefined;
	}

	const action = turn.moveType satisfies ActionKind;

	return {
		moveType: "takeAction" as const,
		input: {
			action,
			...( "target" in turn ? { target: turn.target } : {} )
		}
	};
};
