import { type CardSet, SORTED_DECK } from "./card-const";
import { intersection } from "./card-utils";
import { type IPlayingCard, PlayingCard } from "./playing-card";

export interface ICardHand {
	cards: IPlayingCard[];
}

export class CardHand implements ICardHand {
	private constructor( cards: IPlayingCard[] = [] ) {
		this._cards = cards.map( PlayingCard.from );
	}

	private _cards: PlayingCard[];

	get cards() {
		return this._cards;
	}

	get length() {
		return this._cards.length;
	}

	get cardSetsInHand() {
		return Array.from( new Set( this._cards.map( card => card.cardSet ) ) );
	}

	get cardSuitsInHand() {
		return Array.from( new Set( this._cards.map( card => card.suit ) ) );
	}

	private get ids() {
		return this._cards.map( c => c.cardId );
	}

	static create( cards: PlayingCard[] ) {
		return new CardHand( cards );
	}

	static from( data: ICardHand ) {
		return new CardHand( data.cards );
	}

	static empty() {
		return new CardHand();
	}

	isEmpty() {
		return this.length === 0;
	}

	contains( card: PlayingCard ) {
		return this.ids.includes( card.cardId );
	}

	containsAll( cards: PlayingCard[] ) {
		return intersection( cards.map( c => c.cardId ), this.ids ).length === cards.length;
	}

	containsSome( cards: PlayingCard[] ) {
		return intersection( cards.map( c => c.cardId ), this.ids ).length > 0;
	}

	sorted() {
		return new CardHand( intersection( SORTED_DECK.map( c => c.cardId ), this.ids )
			.map( PlayingCard.fromId ) );
	}

	map<T>( fn: ( card: PlayingCard ) => T ): T[] {
		return this._cards.map( fn );
	}

	removeCard( card: PlayingCard ) {
		this._cards = this._cards.filter( c => c.rank !== card.rank || c.suit !== card.suit );
	}

	removeCardsOfSet( cardSet: CardSet ) {
		const removedCards: PlayingCard[] = [];

		this._cards = this._cards.filter( c => {
			const card = PlayingCard.from( c );
			if ( card.cardSet !== cardSet ) {
				removedCards.push( card );
				return true;
			}

			return false;
		} );

		return removedCards;
	}

	addCard( ...cards: PlayingCard[] ) {
		this._cards.push( ...cards );
	}

	getCardsOfSet( cardSet: CardSet ) {
		return this._cards.filter( card => card.cardSet === cardSet );
	}

	getCardAt( index: number ) {
		return this._cards[ index ];
	}

	serialize(): ICardHand {
		return { cards: this._cards.map( card => card.serialize() ) };
	}
}