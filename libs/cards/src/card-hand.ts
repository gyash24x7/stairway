import { IPlayingCard, PlayingCard } from "./playing-card";
import type { CardSet } from "./card-const";
import { SORTED_DECK } from "./card-const";
import { filter, includes, intersection, pull, remove, uniq } from "lodash";

export interface ICardHand {
	cards: IPlayingCard[]
}

export class CardHand implements ICardHand {
	cards: PlayingCard[] = [];

	private constructor( cards: IPlayingCard[] ) {
		this.cards = cards.map( PlayingCard.from )
	}

	get length() {
		return this.cards.length;
	}

	get cardSetsInHand() {
		return uniq( this.cards.map( card => card.set ) );
	}

	get cardSuitsInHand() {
		return uniq( this.cards.map( card => card.suit ) );
	}

	private get ids() {
		return this.cards.map( c => c.id );
	}

	static from( hand: ICardHand ) {
		return new CardHand( hand.cards );
	}

	contains( card: PlayingCard ) {
		return includes( this.ids, card.id );
	}

	containsAll( cards: PlayingCard[] ) {
		return intersection( cards.map( c => c.id ), this.ids ).length === cards.length;
	}

	containsSome( cards: PlayingCard[] ) {
		return intersection( cards.map( c => c.id ), this.ids ).length > 0;
	}

	sorted() {
		return new CardHand( intersection( SORTED_DECK.map( c => c.id ), this.ids ).map( PlayingCard.fromId ) );
	}

	map<T>( fn: ( card: PlayingCard ) => T ): T[] {
		return this.cards.map( fn );
	}

	removeCard( card: PlayingCard ) {
		const ids = this.ids;
		pull( ids, card.id );
		this.cards = ids.map( PlayingCard.fromId );
	}

	removeCardsOfSet( cardSet: CardSet ) {
		remove( this.cards, [ "set", cardSet ] );
	}

	addCard( ...cards: PlayingCard[] ) {
		this.cards.push( ...cards )
	}

	getCardsOfSet( set: CardSet ) {
		return filter( this.cards, [ "set", set ] );
	}

	get( index: number ) {
		return this.cards[ index ];
	}

	serialize() {
		return JSON.parse( JSON.stringify( this ) );
	}
}