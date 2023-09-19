import { CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";
import { playingCardClassnames as classnames } from "../styles";
import { Group, Title } from "@mantine/core";


export interface DisplayCardProps {
	card: PlayingCard;
}

export const suitSrcMap: Record<CardSuit, string> = {
	[ CardSuit.CLUBS ]: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/clubs.png",
	[ CardSuit.SPADES ]: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/spades.png",
	[ CardSuit.HEARTS ]: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/hearts.png",
	[ CardSuit.DIAMONDS ]: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/diamonds.png"
};

export const rankTextMap: Record<CardRank, string> = {
	Ace: "A", Two: "2", Ten: "10", Three: "3", Five: "5", Four: "4", Seven: "7", Six: "6",
	Eight: "8", Nine: "9", Jack: "J", Queen: "Q", King: "K"
};

export function DisplayCardSet( { cardSet }: { cardSet: CardSet } ) {
	const cardSetPosition = cardSet.split( " " )[ 0 ];
	const cardSuit = cardSet.split( " " )[ 1 ] as CardSuit;

	return (
		<Group gap={ "xs" }>
			<h2 className={ classnames.cardColor[ cardSuit ] }>{ cardSetPosition }</h2>
			<img src={ suitSrcMap[ cardSuit ] } alt={ cardSet } width={ 32 } height={ 32 }/>
		</Group>
	);
}

export function DisplayCard( { card }: DisplayCardProps ) {
	return (
		<div className={ classnames.wrapper }>
			<Title order={ 2 } className={ classnames.cardColor[ card.suit ] }>
				{ rankTextMap[ card.rank ] }
			</Title>
			<img src={ suitSrcMap[ card.suit ] } alt={ card.cardId } width={ 16 } height={ 16 }/>
		</div>
	);

}