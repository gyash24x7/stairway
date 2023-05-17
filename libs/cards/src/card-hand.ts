import type { CardSet } from "./card-const";
import { SORTED_DECK } from "./card-const";
import { intersection } from "./card-utils";
import { IPlayingCard, PlayingCard } from "./playing-card";

export interface ICardHand {
	cards: IPlayingCard[];
}

export class CardHand implements ICardHand {
	cards: PlayingCard[] = [];

	private constructor( cards: IPlayingCard[] ) {
		this.cards = cards.map( PlayingCard.from );
	}

	get length() {
		return this.cards.length;
	}

	get cardSetsInHand() {
		return Array.from( new Set( this.cards.map( card => card.set ) ) );
	}

	get cardSuitsInHand() {
		return Array.from( new Set( this.cards.map( card => card.suit ) ) );
	}

	private get ids() {
		return this.cards.map( c => c.id );
	}

	static from( hand: ICardHand ) {
		return new CardHand( hand.cards );
	}

	contains( card: PlayingCard ) {
		return this.ids.includes( card.id );
	}

	containsAll( cards: PlayingCard[] ) {
		return intersection( cards.map( c => c.id ), this.ids ).length === cards.length;
	}

	containsSome( cards: PlayingCard[] ) {
		return intersection( cards.map( c => c.id ), this.ids ).length > 0;
	}

	sorted() {
		return new CardHand( intersection( SORTED_DECK.map( c => c.id ), this.ids )
			.map( PlayingCard.fromId ) );
	}

	map<T>( fn: ( card: PlayingCard ) => T ): T[] {
		return this.cards.map( fn );
	}

	removeCard( card: PlayingCard ) {
		this.cards = this.cards.filter( c => c.rank !== card.rank || c.suit !== card.suit );
	}

	removeCardsOfSet( cardSet: CardSet ) {
		this.cards = this.cards.filter( card => card.set !== cardSet );
	}

	addCard( ...cards: PlayingCard[] ) {
		this.cards.push( ...cards );
	}

	getCardsOfSet( cardSet: CardSet ) {
		return this.cards.filter( card => card.set === cardSet );
	}

	get( index: number ) {
		return this.cards[ index ];
	}

	serialize() {
		return JSON.parse( JSON.stringify( this ) );
	}
}