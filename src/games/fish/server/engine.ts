import { castDraft, produce } from "immer";

import {
	Ask,
	BookClaimed,
	CardAsked,
	Claim,
	FishConfig,
	FishEvent,
	FishMoveSchemas,
	FishSeatData,
	FishState,
	FishView,
	HandsDealt,
	Transfer,
	TurnTransferred
} from "@/games/fish/schema";
import { decideFishMove } from "@/games/fish/server/bot/policy";
import {
	bookOfClaim,
	canTransferTurn,
	claimsOf,
	fishConfigFor,
	getBookForCard,
	getCardsOfBook,
	getLiveBooks,
	getMetrics,
	getTeamScores,
	holderOf,
	isBookInHand,
	isGameComplete,
	lastAsk,
	lastClaim,
	lastTransfer,
	nextHolder
} from "@/games/fish/utils";
import type { CardId } from "@/shared/utils/cards";
import { generateHands, getSortedHand } from "@/shared/utils/cards";
import { InvalidMove } from "@/swish/errors";
import type { PlayerId } from "@/swish/schema";
import { Standing, Standings, TeamStanding } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { areTeammates, playerIdFor, teamMatesOf, teamOf } from "@/swish/utils";


// --- Engine -----------------------------------------------------------------

/**
 * Fish (Literature), built from its declarative structure.
 *
 * This is the engine's only team game, and almost everything unusual about it
 * follows from that. The sides are the engine's business — `start` balances
 * whoever picked nothing and interleaves the seating order — while the turn
 * order is emphatically this game's: fish does not pass round the table, it
 * passes to whoever the last ask named, and it skips a seat that has run out of
 * cards entirely. So `resolveNextPlayer` is written out rather than defaulted.
 *
 * As in every game here the type arguments are inferred rather than written, and
 * only because the structure is the literal argument to `makeEngine`. Lift it out
 * to a `const` and `schemas.moves` stops being an inference site: the move
 * callbacks' inputs fall back to `any` and the structure stops being assignable.
 */
export const {
	EngineLive: FishEngineLive,
	Engine: FishEngine,
	Structure: FishStructure
} = makeEngine( {
	name: "fish",

	schemas: {
		state: FishState,
		config: FishConfig,
		events: FishEvent,
		view: FishView,
		moves: FishMoveSchemas
	},

	/**
	 * Six seats, two sides, the standard variant — and `autoStart` off, because the
	 * lobby is where sides are picked and a table that started itself the moment the
	 * last seat filled would never give anyone the chance.
	 */
	defaultConfig: () => fishConfigFor( 6, "NORMAL", 2 ),

	/**
	 * An empty table. The deal cannot happen here: `setup` runs at creation,
	 * when nobody has joined yet, so there is no roster to deal to and no seating
	 * order to deal in. `hooks.onStart` is the first point either exists.
	 */
	setup: () => FishState.make( { hands: {}, cardCounts: {}, moves: [] } ),

	apply: ( state, event ) => produce( state, draft => {
		switch ( event._tag ) {
			case "fish/ev/HandsDealt":
				draft.hands = castDraft( event.hands );
				draft.cardCounts = { ...event.cardCounts };
				return;

			case "fish/ev/CardAsked": {
				const { ask } = event;
				draft.moves.push( ask );

				// A failed ask moves nothing. What it *proves* — that neither seat holds
				// the card — is not written down anywhere either: it follows from the ask
				// now in the history, and `possibleHolders` derives it on demand.
				if ( !ask.success ) {
					return;
				}

				const askingPlayerHand = draft.hands[ ask.playerId ] ?? [];
				const askedPlayerHand = draft.hands[ ask.from ] ?? [];

				draft.hands[ ask.from ] = askedPlayerHand.filter( card => card !== ask.cardId );
				draft.hands[ ask.playerId ] = getSortedHand( [ ...askingPlayerHand, ask.cardId ] );
				draft.cardCounts[ ask.from ] = draft.hands[ ask.from ]?.length ?? 0;
				draft.cardCounts[ ask.playerId ] = draft.hands[ ask.playerId ]?.length ?? 0;
				return;
			}

			case "fish/ev/BookClaimed": {
				draft.moves.push( event.claim );

				// A declaration takes the book out of play whether or not it was right, so
				// its cards leave every hand either way. Which side scored it is not folded
				// in here at all — `getBookWinner` derives it from the declaration, and a
				// tally kept alongside could only ever disagree with it.
				const cards = new Set<CardId>( getCardsOfBook( event.claim.book ) );
				for ( const playerId of Object.keys( draft.hands ) as PlayerId[] ) {
					const hand = draft.hands[ playerId ] ?? [];
					draft.hands[ playerId ] = hand.filter( card => !cards.has( card ) );
					draft.cardCounts[ playerId ] = draft.hands[ playerId ].length;
				}

				return;
			}

			case "fish/ev/TurnTransferred":
				// Nothing moves: the turn itself is the engine's, handed on by
				// `resolveNextPlayer` reading this very entry back.
				draft.moves.push( event.transfer );
		}
	} ),

	/**
	 * Every book declared. There is nothing left to ask for at that point — a
	 * declaration takes its book's cards out of every hand — so every seat is empty
	 * and the table is played out.
	 */
	endIf: ( { state, config } ) => isGameComplete( state, config.books ),

	/**
	 * Hands are the only private region, and they are redacted by being replaced
	 * rather than removed: every audience gets the same shape, with `cardCounts`
	 * saying how many cards each seat holds and `hand` filled in only for the seat
	 * the view was built for. A spectator's view carries an empty hand, which is
	 * also what a player who has run out sees of their own.
	 *
	 * `metrics` appears only once the last book has been declared. It is a summary
	 * of the history rather than a source, and the history it is folded from is
	 * there to read in the meantime.
	 */
	view: ( { state, config, context }, audience ) => {
		const playerId = playerIdFor( audience );

		return FishView.make( {
			cardCounts: state.cardCounts,
			moves: state.moves,
			playerId,
			hand: playerId ? getSortedHand( [ ...( state.hands[ playerId ] ?? [] ) ] ) : [],
			metrics: isGameComplete( state, config.books )
				? getMetrics( state, context.players )
				: undefined
		} );
	},

	/**
	 * A side's result is books, and a seat's is the books it brought in itself.
	 *
	 * `teamRanking` is filled here rather than left to the engine to compile.
	 * Compiling it would total the players' scores, and a book belongs to the side
	 * once — summing a per-seat score across a side would count each of its books
	 * as many times as the side has seats. The players are still ranked, by the
	 * side they were on: fish is won together, so everyone on the winning side
	 * placed first, and how much each of them contributed is their `score`.
	 */
	resolveResults: ( { state, config, context } ) => {
		const scores = getTeamScores( claimsOf( state ), context, config.teams );
		const metrics = getMetrics( state, context.players );

		const sides = [ ...config.teams ].sort(
			( left, right ) => ( scores[ right ] ?? 0 ) - ( scores[ left ] ?? 0 )
		);

		const rankOf = ( team: string | undefined ) =>
			sides.findIndex( side => side === team ) + 1 || sides.length;

		const teamRanking = sides.map( team => TeamStanding.make( {
			team,
			rank: sides.findIndex( other => scores[ other ] === scores[ team ] ) + 1,
			score: scores[ team ]
		} ) );

		const ranking = [ ...context.players ]
			.sort( ( left, right ) => {
				const bySide = rankOf( teamOf( context, left ) ) - rankOf( teamOf( context, right ) );
				return bySide !== 0
					? bySide
					: ( metrics[ right ]?.successfulClaims ?? 0 ) -
					( metrics[ left ]?.successfulClaims ?? 0 );
			} )
			.map( playerId => Standing.make( {
				playerId,
				rank: rankOf( teamOf( context, playerId ) ),
				score: metrics[ playerId ]?.successfulClaims ?? 0,
				team: teamOf( context, playerId )
			} ) );

		return Standings.make( { ranking, teamRanking, winningTeam: sides[ 0 ] } );
	},

	hooks: {

		/**
		 * The deal. This is the first moment there is anything to deal to: the sides
		 * have just been balanced and the seats interleaved, so `context.players` is
		 * the final seating order.
		 *
		 * Randomness is safe here for the same reason it is in `execute` — the shuffle
		 * rides out on `HandsDealt`, and a replay folds that event rather than dealing
		 * again. The deck is built from the books in play rather than from a card count,
		 * which is what keeps the two in step: a 48-card table is one whose variant
		 * deals twelve books, and a book with no cards would leave `endIf` one
		 * declaration short of ever firing.
		 */
		onStart: ( { config, context }, rng ) => {
			const deck = rng( "deal" ).shuffle(
				config.books.flatMap( book => [ ...getCardsOfBook( book ) ] )
			);

			const dealt = generateHands( deck, context.players.length );
			const hands: Record<PlayerId, ReadonlyArray<CardId>> = {};
			const cardCounts: Record<PlayerId, number> = {};

			context.players.forEach( ( playerId, seat ) => {
				const hand = getSortedHand( dealt[ seat ] ?? [] );
				hands[ playerId ] = hand;
				cardCounts[ playerId ] = hand.length;
			} );

			return [ HandsDealt.make( { hands, cardCounts } ) ];
		}
	},

	moves: {

		/**
		 * Asking an opponent for a card. The classic three rules, and a fourth that
		 * only matters at the end: a seat with no cards has nothing to hand over, and
		 * asking it would burn a turn proving so.
		 */
		askCard: {
			validate: ( { state, config, context }, playerId, input ) => {
				// `areTeammates` is also the self-check: a seat is on its own side, so
				// asking yourself is caught here rather than needing a rule of its own.
				if ( areTeammates( context, playerId, input.from ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You can only ask an opponent for a card."
					} );
				}

				if ( ( state.cardCounts[ input.from ] ?? 0 ) === 0 ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "That player has no cards left."
					} );
				}

				const hand = state.hands[ playerId ] ?? [];
				if ( hand.includes( input.cardId ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You already hold that card."
					} );
				}

				// The book the card belongs to has to be one this variant deals — a seven
				// is in no CANADIAN book at all — and it has to still be in play, which
				// holding a card of it already implies: a declaration empties every hand
				// of that book.
				const book = getBookForCard( input.cardId, config.type );
				if ( !book || !isBookInHand( hand, book, config.type ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You can only ask for a card in a book you hold a card of."
					} );
				}

				return;
			},

			/**
			 * Whether the ask landed is read off the table, not rolled for: the card is
			 * either in that hand or it is not. The outcome rides out on the event all
			 * the same, because `apply` is what moves the card and it only ever sees the
			 * event.
			 */
			execute: ( { state }, playerId, input ) => [
				CardAsked.make( {
					ask: Ask.make( {
						success: ( state.hands[ input.from ] ?? [] ).includes( input.cardId ),
						playerId,
						from: input.from,
						cardId: input.cardId
					} )
				} )
			]
		},

		/**
		 * Declaring a book: saying where all of it sits, and being scored on it.
		 *
		 * A declaration may only name the declarer's own side. That is a rule rather
		 * than a losing move — naming an opponent as a holder is refused outright —
		 * and it is what makes a book the side holds outright untakeable: asking in a
		 * book needs one of its cards and so does declaring it, so a side holding all
		 * of them cannot be reached by anyone.
		 */
		claimBook: {
			validate: ( { state, config, context }, playerId, input ) => {
				const book = bookOfClaim( input.claim, config.type );
				if ( !book || !config.books.includes( book ) ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "A declaration must name every card of exactly one book."
					} );
				}

				if ( !getLiveBooks( state, config.books ).includes( book ) ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "That book has already been declared."
					} );
				}

				if ( !isBookInHand( state.hands[ playerId ] ?? [], book, config.type ) ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "You can only declare a book you hold a card of."
					} );
				}

				const named = Object.values( input.claim );
				if ( !named.every( holder => areTeammates( context, playerId, holder ) ) ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "A declaration may only name your own side as the holders."
					} );
				}

				return;
			},

			/**
			 * Where the cards really are is recorded next to where they were said to be,
			 * so the verdict can be re-read later without the hands the declaration
			 * emptied. Which side the book goes to is not recorded: `getBookWinner`
			 * derives it from `success`, the declarer and `correctClaim`, all of which
			 * are on this event.
			 */
			execute: ( { state, config }, playerId, input ) => {
				const book = bookOfClaim( input.claim, config.type )!;
				const correctClaim: Record<string, PlayerId> = {};

				for ( const card of getCardsOfBook( book ) ) {
					const holder = holderOf( state.hands, card );
					if ( holder ) {
						correctClaim[ card ] = holder;
					}
				}

				return [
					BookClaimed.make( {
						claim: Claim.make( {
							success: getCardsOfBook( book )
								.every( card => correctClaim[ card ] === input.claim[ card ] ),
							playerId,
							book,
							correctClaim,
							actualClaim: input.claim
						} )
					} )
				];
			}
		},

		/**
		 * Handing the turn to a teammate. Legal only while holding a fresh successful
		 * declaration, which `canTransferTurn` reads off the tail of the history —
		 * asking whether the declaration is in there at all would let a seat bank the
		 * right to transfer and spend it half a game later.
		 */
		transferTurn: {
			validate: ( { state, context }, playerId, input ) => {
				if ( !canTransferTurn( state, playerId ) ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "You can only transfer the turn right after declaring a book correctly."
					} );
				}

				if ( input.transferTo === playerId
					|| !areTeammates( context, playerId, input.transferTo ) ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "You can only transfer the turn to a teammate."
					} );
				}

				if ( ( state.cardCounts[ input.transferTo ] ?? 0 ) === 0 ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "That teammate has no cards left."
					} );
				}

				return;
			},

			execute: ( _data, playerId, input ) => [
				TurnTransferred.make( {
					transfer: Transfer.make( { playerId, transferTo: input.transferTo } )
				} )
			]
		}
	},

	/**
	 * Where the turn goes, read off what just happened rather than off the seating
	 * order.
	 *
	 * No fish move declares `endsTurn`, so every one of them ends its turn and this
	 * is asked after all of them — including the two whose reward is to carry on,
	 * which answer with the seat that just played. Keeping the turn and taking
	 * another one are the same thing to everyone watching, and saying it this way
	 * means the turn counter moves whenever anybody acts.
	 *
	 * That matters beyond bookkeeping: the engine measures its clocks from the
	 * moment the pending seat last changed, so a move that left the turn where it
	 * was left a bot's delay and a player's timeout both counting from the start of
	 * the turn. A bot would rattle off every landed ask in one burst, and a player
	 * lost thinking time by finding cards. Advancing the turn on every move is what
	 * gives each ask its own clock.
	 *
	 * - a landed ask keeps the seat: the reward for guessing right is another guess
	 * - a missed ask hands the turn to the seat that was asked, who by the ask's own
	 *   validation still holds cards
	 * - a correct declaration keeps the seat, which is also the only way to choose
	 *   which teammate plays next — the declarer stays on to transfer it, even with
	 *   an empty hand of their own
	 * - a transfer hands it to the named teammate, who holds cards
	 * - a wrong declaration hands it to the opposition: the next opposing seat still
	 *   holding cards, and failing that anyone who does
	 * - anything else — a correct declaration by a side that has run out, or the
	 *   engine passing a turn nobody played — falls through to the next seat holding
	 *   cards, which at an interleaved table is the next side along
	 *
	 * Every branch ends on a seat that can act: one holding cards, or a declarer
	 * whose side still holds some and who therefore has a transfer to make. Only a
	 * table where nobody holds anything falls back to the seat that just acted, and
	 * that is a table `endIf` has already ended.
	 */
	resolveNextPlayer: ( { state, context }, playerId, moveType ) => {
		const ask = lastAsk( state );
		if ( moveType === "askCard" && ask ) {
			return ask.success ? playerId : ask.from;
		}

		const transfer = lastTransfer( state );
		if ( moveType === "transferTurn" && transfer ) {
			return transfer.transferTo;
		}

		const claim = lastClaim( state );

		// A correct declaration holds the turn for the transfer it earns. A side with
		// nothing left to play has no transfer to make and no move to spend the turn
		// on, so it falls through rather than stalling the table for good.
		if ( moveType === "claimBook" && claim?.success ) {
			const sideHolds = [ playerId, ...teamMatesOf( context, playerId ) ]
				.some( seat => ( state.cardCounts[ seat ] ?? 0 ) > 0 );

			if ( sideHolds ) {
				return playerId;
			}
		}

		const opponentFirst = moveType === "claimBook" && claim && !claim.success;

		const next = opponentFirst
			? nextHolder(
				context,
				state.cardCounts,
				playerId,
				candidate => !areTeammates( context, playerId, candidate )
			)
			: undefined;

		return next ?? nextHolder( context, state.cardCounts, playerId ) ?? playerId;
	},

	/**
	 * The bot plays from the seat's own view and nothing else, which is the point:
	 * it deduces where the cards are from the same public history a player reads,
	 * plus the one hand it is entitled to see. `bot/README.md` is the account of how.
	 *
	 * A fish table cannot move on without the seat whose turn it is, so a seat that
	 * walks away is handed to this policy through `autoPlay` and stays there until
	 * its player takes it back. The deductions it makes are ones that seat could
	 * have made itself.
	 */
	botMove: ( data ) => {
		const playerId = data.state.playerId;
		if ( playerId === undefined ) {
			return undefined;
		}

		return decideFishMove( FishSeatData.make( {
			config: data.config,
			context: data.context,
			state: { ...data.state, playerId }
		} ) );
	}
} );
