import type { CardId, PlayingCard } from "@/libs/cards/types";
import { getCardFromId, getCardId, isCardInHand } from "@/libs/cards/utils";
import { CANADIAN_FISH_BOOKS, NORMAL_FISH_BOOKS } from "@/libs/fish/constants";
import type { CanadianFishBook, FishBook, FishBookType, NormalFishBook } from "@/libs/fish/types";

export function getBookForCard( cardId: CardId, bookType: FishBookType ): FishBook {
	switch ( bookType ) {
		case "NORMAL":
			return Object.keys( NORMAL_FISH_BOOKS ).map( book => book as keyof typeof NORMAL_FISH_BOOKS )
				.find( book => NORMAL_FISH_BOOKS[ book ].includes( cardId ) )!;

		case "CANADIAN":
			return Object.keys( CANADIAN_FISH_BOOKS ).map( book => book as keyof typeof CANADIAN_FISH_BOOKS )
				.find( book => CANADIAN_FISH_BOOKS[ book ].includes( cardId ) )!;
	}
}

export function getBooksInHand( hand: PlayingCard[], bookType: FishBookType ): FishBook[] {
	const books = new Set<FishBook>( hand.map( getCardId ).map( cardId => getBookForCard( cardId, bookType ) ) );
	return Array.from( books );
}

export function isBookInHand( hand: PlayingCard[], book: FishBook, bookType: FishBookType ): boolean {
	return getBooksInHand( hand, bookType ).includes( book );
}

export function getMissingCards( hand: PlayingCard[], book: FishBook, bookType: FishBookType ): CardId[] {
	return bookType === "NORMAL"
		? NORMAL_FISH_BOOKS[ book as NormalFishBook ].filter( ( cardId ) => !isCardInHand( hand, cardId ) )
		: CANADIAN_FISH_BOOKS[ book as CanadianFishBook ].filter( ( cardId ) => !isCardInHand( hand, cardId ) );
}

export function getCardsOfBook( book: FishBook, bookType: FishBookType, hand?: PlayingCard[] ): PlayingCard[] {
	const cards = bookType === "NORMAL"
		? NORMAL_FISH_BOOKS[ book as NormalFishBook ]
		: CANADIAN_FISH_BOOKS[ book as CanadianFishBook ];

	return cards.filter( card => !hand || isCardInHand( hand, card ) ).map( getCardFromId );
}