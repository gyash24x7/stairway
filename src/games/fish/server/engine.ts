import * as Match from "effect/Match";
import { castDraft, produce } from "immer";

import { decideFishMove } from "@/games/fish/server/bot/policy.ts";
import { getClaimedBooks, getMetrics, isGameComplete } from "@/games/fish/server/utils.ts";
import {
	Ask,
	AskCardInput,
	BookClaimed,
	CardAsked,
	Claim,
	ClaimBookInput,
	FishConfig,
	FishEvent,
	FishState,
	FishView,
	HandsDealt,
	Transfer,
	TransferTurnInput,
	TurnTransferred
} from "@/games/fish/shared/schema.ts";
import {
	canTransferTurn,
	claimsOf,
	getBookForCard,
	getCardsOfBook,
	getTeamScores
} from "@/games/fish/shared/utils.ts";
import { CARD_RANKS, generateDeck, generateHands, getCardRank } from "@/shared/cards/utils.ts";
import { remove } from "@/shared/utils/array.ts";
import { makeEngine } from "@/swish/server/engine.ts";
import { playerIdFor } from "@/swish/server/utils.ts";
import { InvalidMove, Standings } from "@/swish/shared/schema.ts";
import { areTeammates, membersOf, opponentsOf, teamMatesOf } from "@/swish/shared/teams.ts";

import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId, TeamId } from "@/swish/shared/schema.ts";


// --- Engine ----------------------------------------------------------------

export const fish = makeEngine( {
	name: "fish",
	schemas: {
		state: FishState,
		config: FishConfig,
		events: FishEvent,
		view: FishView,
		moves: {
			askCard: AskCardInput,
			claimBook: ClaimBookInput,
			transferTurn: TransferTurnInput
		}
	},

	setup: () => FishState.make( { hands: {}, cardCounts: {}, moves: [] } ),

	apply: ( state, event ) =>
		produce( state, ( draft ) => {
			Match.value( event ).pipe(
				Match.tag( "fish/ev/HandsDealt", ( e ) => {
					draft.hands = castDraft( e.hands );
					draft.cardCounts = castDraft( e.cardCounts );
				} ),

				Match.tag( "fish/ev/CardAsked", ( { ask } ) => {
					if ( ask.success ) {
						const askedPlayerHand = draft.hands[ ask.from ] ?? [];
						draft.hands[ ask.from ] = askedPlayerHand.filter( c => c !== ask.cardId );
						draft.cardCounts[ ask.from ] = ( draft.cardCounts[ ask.from ] ?? 0 ) - 1;

						( draft.hands[ ask.playerId ] ??= [] ).push( ask.cardId );
						draft.cardCounts[ ask.playerId ] = ( draft.cardCounts[ ask.playerId ] ?? 0 ) + 1;
					}

					draft.moves.push( castDraft( ask ) );
				} ),

				Match.tag( "fish/ev/BookClaimed", ( { claim } ) => {
					const allBookCards = getCardsOfBook( claim.book );
					for ( const [ pid, hand ] of Object.entries( draft.hands ) ) {
						draft.hands[ pid as PlayerId ] = hand.filter( c => !allBookCards.includes( c ) );
					}

					for ( const card of allBookCards ) {
						const owner = claim.correctClaim[ card ];
						if ( owner ) {
							draft.cardCounts[ owner ] = ( draft.cardCounts[ owner ] ?? 0 ) - 1;
						}
					}

					draft.moves.push( castDraft( claim ) );
				} ),

				Match.tag( "fish/ev/TurnTransferred", ( e ) => {
					draft.moves.push( castDraft( e.transfer ) );
				} ),

				Match.exhaustive
			);
		} ),

	endIf: ( { state, config } ) => isGameComplete( state, config.books ),

	resolveResults: ( { state, config, context } ) => {
		const scores = getTeamScores( claimsOf( state ), context, config.teams );

		// Stable, so sides level on books stay in the order the config declares them.
		const ordered = [ ...config.teams ].sort( ( a, b ) => scores[ b ]! - scores[ a ]! );

		const ranks = new Map<TeamId, number>();
		let rank = 0;
		let previous: number | undefined;

		for ( const team of ordered ) {
			if ( scores[ team ] !== previous ) {
				rank = rank + 1;
				previous = scores[ team ];
			}

			ranks.set( team, rank );
		}

		const ranking = ordered.flatMap( team => membersOf( context, team ).map( playerId => ( {
			playerId,
			rank: ranks.get( team )!,
			score: scores[ team ]!,
			team
		} ) ) );

		const teamRanking = ordered.map(
			team => ( { team, rank: ranks.get( team )!, score: scores[ team ]! } )
		);

		const [ top, runnerUp ] = teamRanking;
		const drawn = top === undefined || top.score === runnerUp?.score;

		return Standings.make( {
			ranking,
			teamRanking,
			...( drawn ? {} : { winningTeam: top.team } )
		} );
	},

	/**
	 * The table as one audience sees it: everything public, plus that seat's own
	 * cards — and, once the last book has been declared, how everyone played.
	 *
	 * The summary is folded here rather than stamped into the state at completion,
	 * so it stays a projection of the histories: it cannot drift from them, and it
	 * costs nothing on the turns nobody is reading it. It rides the same envelope
	 * as everything else, so the archive keeps it too.
	 */
	view: ( { state, config, context }, audience ) => {
		const { hands, ...rest } = state;
		const playerId = playerIdFor( audience );
		const hand = playerId ? hands[ playerId ] ?? [] : [];

		const metrics = isGameComplete( state, config.books )
			? getMetrics( state, context.players )
			: undefined;

		return FishView.make( { ...rest, playerId, hand, metrics } );
	},

	hooks: {
		onStart: ( { config, context }, rng ) => {
			let deck = generateDeck( rng( "deal" ).next );
			if ( config.deckType === 48 ) {
				deck = remove( card => getCardRank( card ) === CARD_RANKS.SEVEN, deck );
			}

			const dealt = generateHands( deck, context.players.length );
			if ( dealt.length !== context.players.length ) {
				return [];
			}

			const hands: Record<PlayerId, CardId[]> = {};
			const cardCounts: Record<PlayerId, number> = {};

			for ( let i = 0; i < context.players.length; i++ ) {
				hands[ context.players[ i ] ] = dealt[ i ];
				cardCounts[ context.players[ i ] ] = dealt[ i ].length;
			}

			return [ HandsDealt.make( { hands, cardCounts } ) ];
		}
	},

	moves: {

		askCard: {

			validate: ( { state, config, context }, playerId, input ) => {
				const hand = state.hands[ playerId ];
				if ( !hand || hand.length === 0 ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You have no cards! Transfer your turn instead."
					} );
				}

				const opponents = opponentsOf( context, playerId );
				if ( !opponents.includes( input.from ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You can only ask opponents for cards!"
					} );
				}

				if ( ( state.hands[ input.from ] ?? [] ).length === 0 ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "That player has no cards left!"
					} );
				}

				const book = getBookForCard( input.cardId, config.type );
				if ( !book || !config.books.includes( book ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "That card is not in this game's deck!"
					} );
				}

				const hasCardFromBook = hand.some( c => getBookForCard( c, config.type ) === book );
				if ( !hasCardFromBook ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You must hold atleast 1 card from the book!"
					} );
				}

				if ( hand.includes( input.cardId ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "You already have this card!"
					} );
				}

				if ( getClaimedBooks( state ).includes( book ) ) {
					return new InvalidMove( {
						move: "askCard",
						reason: "This book has already been claimed!"
					} );
				}

				return undefined;
			},

			execute: ( { state }, playerId, input ) => {
				const success = ( state.hands[ input.from ] ?? [] ).includes( input.cardId );
				const ask = Ask.make( { success, playerId, ...input } );
				return [ CardAsked.make( { ask } ) ];
			}
		},

		claimBook: {

			validate: ( { state, config, context }, playerId, input ) => {
				const claimedCards = Object.keys( input.claim ) as CardId[];
				if ( claimedCards.length === 0 ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "Claim cannot be empty!"
					} );
				}

				const invalidCard = claimedCards.some( c => {
					const cardBook = getBookForCard( c, config.type );
					return !cardBook || !config.books.includes( cardBook );
				} );

				if ( invalidCard ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "Claim contains a card that is not in this game's deck!"
					} );
				}

				const books = new Set( claimedCards.map( c => getBookForCard( c, config.type ) ) );
				if ( books.size !== 1 ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "All cards must belong to the same book!"
					} );
				}

				const book = [ ...books ][ 0 ]!;
				if ( getClaimedBooks( state ).includes( book ) ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "This book has already been claimed!"
					} );
				}

				const hand = state.hands[ playerId ] ?? [];
				if ( !hand.some( c => getBookForCard( c, config.type ) === book ) ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: "You must hold atleast 1 card from the book!"
					} );
				}

				const allBookCards = getCardsOfBook( book );
				if ( claimedCards.length !== allBookCards.length ) {
					return new InvalidMove( {
						move: "claimBook",
						reason: `Must claim all ${ allBookCards.length } cards in the book!`
					} );
				}

				for ( const card of allBookCards ) {
					if ( !claimedCards.includes( card ) ) {
						return new InvalidMove( {
							move: "claimBook",
							reason: `Missing card ${ card } from claim!`
						} );
					}
				}

				for ( const card of Object.keys( input.claim ) ) {
					const pid = input.claim[ card ] as PlayerId | undefined;
					if ( pid && !context.players.includes( pid ) ) {
						return new InvalidMove( {
							move: "claimBook",
							reason: `Player ${ pid } is not in this game!`
						} );
					}

					if ( pid && pid !== playerId && !areTeammates( context, playerId, pid ) ) {
						return new InvalidMove( {
							move: "claimBook",
							reason: "You can only claim cards held by your own team!"
						} );
					}
				}

				return undefined;
			},
			execute: ( { state, config }, playerId, input ) => {
				const claimedCards = Object.keys( input.claim ) as CardId[];
				const book = getBookForCard( claimedCards[ 0 ], config.type )!;
				const allBookCards = getCardsOfBook( book );

				const correctClaim: Record<string, PlayerId> = {};
				for ( const card of allBookCards ) {
					for ( const pid of Object.keys( state.hands ) as PlayerId[] ) {
						if ( ( state.hands[ pid ] ?? [] ).includes( card ) ) {
							correctClaim[ card ] = pid;
							break;
						}
					}
				}

				const success = allBookCards.every( card =>
					input.claim[ card ] === correctClaim[ card ]
				);

				const actualClaim = input.claim;
				const claim = Claim.make( { success, playerId, book, actualClaim, correctClaim } );
				return [ BookClaimed.make( { claim } ) ];
			}
		},

		transferTurn: {

			validate: ( { state, context }, playerId, input ) => {
				if ( !canTransferTurn( state, playerId ) ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "You can only transfer turn after a successful claim!"
					} );
				}

				const teamMates = teamMatesOf( context, playerId );
				if ( !teamMates.includes( input.transferTo ) ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "You can only transfer to a teammate!"
					} );
				}

				if ( ( state.hands[ input.transferTo ] ?? [] ).length === 0 ) {
					return new InvalidMove( {
						move: "transferTurn",
						reason: "Cannot transfer to a teammate with no cards!"
					} );
				}

				return undefined;
			},
			execute: ( _data, playerId, input ) => {
				const transfer = Transfer.make( { playerId, transferTo: input.transferTo } );
				return [ TurnTransferred.make( { transfer } ) ];
			}
		}
	},


	/**
	 * Who acts next: a hit keeps the turn, a miss hands it to whoever was asked, a
	 * good declaration keeps it, a bad one gives it to the other side, and a
	 * transfer sends it where it was addressed.
	 *
	 * It reads the move the engine just handed it rather than the history, and
	 * the newest history entry: the acting player and the move are the arguments,
	 * so only the *outcome* has to be looked up — and looking it up by move keeps
	 * the two from ever disagreeing about which move this was.
	 */
	resolveNextPlayer: ( { state, context }, playerId, moveType ) => {
		const holds = ( pid: PlayerId ) => ( state.hands[ pid ]?.length ?? 0 ) > 0;

		let nextPlayer: PlayerId;

		// The move that just landed is the last one in the history, whichever kind
		// it was — which is the whole reason the three lists became one.
		const last = state.moves.at( -1 );

		switch ( moveType ) {
			case "askCard": {
				const ask = last?._tag === "fish/Ask" ? last : undefined;
				nextPlayer = ask?.success === false ? ask.from : playerId;
				break;
			}

			case "claimBook": {
				const claim = last?._tag === "fish/Claim" ? last : undefined;
				if ( claim?.success !== false ) {
					nextPlayer = playerId;
					break;
				}

				nextPlayer = opponentsOf( context, playerId ).find( holds ) ?? context.players[ 0 ];
				break;
			}

			case "transferTurn": {
				const transfer = last?._tag === "fish/Transfer" ? last : undefined;
				nextPlayer = transfer?.transferTo ?? playerId;
				break;
			}

			default: {
				nextPlayer = context.currentPlayer;
			}
		}

		if ( !holds( nextPlayer ) ) {
			return teamMatesOf( context, nextPlayer ).find( holds )
				?? context.players.find( holds )
				?? nextPlayer;
		}

		return nextPlayer;
	},

	botMove: decideFishMove
} );
