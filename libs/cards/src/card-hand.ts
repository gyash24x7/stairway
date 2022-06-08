import { PlayingCard } from "./playing-card";
import type { CardSet, CardSuit } from "./card-const";
import { SORTED_DECK } from "./card-const";
import { Expose, instanceToPlain, plainToInstance, Type } from "class-transformer";
import "reflect-metadata";

export class CardHand {
	@Type( () => PlayingCard )
	@Expose() private cards: PlayingCard[] = [];

	constructor( cards: PlayingCard[] ) {
		this.cards = cards;
	}

	get length() {
		return this.cards.length;
	}

	get cardSetsInHand() {
		const setOfCardSet = new Set<CardSet>();
		this.cards.forEach( card => setOfCardSet.add( card.set ) );
		return Array.from( setOfCardSet );
	}

	get cardSuitsInHand() {
		const cardSuitSet = new Set<CardSuit>();
		this.cards.forEach( card => cardSuitSet.add( card.suit ) );
		return Array.from( cardSuitSet );
	}

	static from( hand: Record<string, any> ) {
		return plainToInstance( CardHand, hand );
	}

	contains( card: PlayingCard ) {
		return !!this.cards.find( ( { rank, suit } ) => card.rank === rank && card.suit === suit );
	}

	containsAll( cards: PlayingCard[] ) {
		for ( const card of cards ) {
			if ( !this.contains( card ) ) {
				return false;
			}
		}
		return true;
	}

	containsSome( cards: PlayingCard[] ) {
		for ( const card of cards ) {
			if ( this.contains( card ) ) {
				return true;
			}
		}
		return false;
	}

	sorted() {
		let gameCards: PlayingCard[] = [];
		SORTED_DECK.forEach( ( card ) => {
			if ( this.contains( card ) ) {
				gameCards.push( card );
			}
		} );

		this.cards = gameCards;
		return this;
	}

	map<T>( fn: ( card: PlayingCard ) => T ): T[] {
		return this.cards.map( fn );
	}

	removeCard( card: PlayingCard ) {
		this.cards = this.cards.filter( ( { rank, suit } ) => card.rank !== rank || card.suit !== suit );
	}

	removeCardsOfSet( cardSet: CardSet ) {
		this.cards = this.cards.filter( card => card.set !== cardSet );
	}

	addCard( ...card: PlayingCard[] ) {
		this.cards = [ ...this.cards, ...card ];
	}

	getCardsOfSet( set: CardSet ) {
		return this.cards.filter( card => card.set === set );
	}

	get( index: number ) {
		return this.cards[ index ];
	}

	serialize() {
		return instanceToPlain( this );
	}
}