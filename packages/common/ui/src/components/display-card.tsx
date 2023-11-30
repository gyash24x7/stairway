import { CardRank, CardSet, CardSuit, PlayingCard } from "@common/cards";
import { Flex, Group, Title } from "@mantine/core";
import { Fragment } from "react";
import classnames from "../styles/components.module.css";

export interface DisplayCardProps {
	card: PlayingCard;
	orientation?: "horizontal" | "vertical";
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
	const cardColorClassname = cardSuit === CardSuit.HEARTS || cardSuit === CardSuit.DIAMONDS
		? classnames[ "playingCardColorRed" ]
		: classnames[ "playingCardColorBlack" ];

	return (
		<div className={ classnames[ "playingCardWrapper" ] }>
			<Group gap={ "xs" }>
				<Title className={ cardColorClassname }>{ cardSetPosition }</Title>
				<img src={ suitSrcMap[ cardSuit ] } alt={ cardSet } width={ 32 } height={ 32 }/>
			</Group>
		</div>
	);
}

export function DisplayCard( { card, orientation }: DisplayCardProps ) {
	const cardColorClassname = card.suit === CardSuit.HEARTS || card.suit === CardSuit.DIAMONDS
		? classnames[ "playingCardColorRed" ]
		: classnames[ "playingCardColorBlack" ];

	return (
		<Fragment>
			{ orientation === "horizontal" ? (
				<Flex className={ classnames[ "playingCardWrapper" ] } gap={ 20 } align={ "center" }>
					<div className={ cardColorClassname }>
						{ rankTextMap[ card.rank ] }
					</div>
					<img src={ suitSrcMap[ card.suit ] } alt={ card.id } width={ 32 } height={ 32 }/>
				</Flex>
			) : (
				<div className={ classnames[ "playingCardWrapper" ] }>
					<div className={ cardColorClassname }>
						{ rankTextMap[ card.rank ] }
					</div>
					<img src={ suitSrcMap[ card.suit ] } alt={ card.id } width={ 32 } height={ 32 }/>
				</div>
			) }
		</Fragment>
	);

}