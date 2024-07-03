import type { CardRank, CardSet, CardSuit, PlayingCard } from "@common/cards";
import { Box, Heading, HStack, Image } from "@gluestack-ui/themed";

export interface DisplayCardProps {
	card: PlayingCard;
}

export const suitSrcMap: Record<CardSuit, string> = {
	Clubs: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/clubs.png",
	Spades: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/spades.png",
	Hearts: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599980/suits/hearts.png",
	Diamonds: "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/diamonds.png"
};

export const rankTextMap: Record<CardRank, string> = {
	Ace: "A", Two: "2", Ten: "10", Three: "3", Five: "5", Four: "4", Seven: "7", Six: "6",
	Eight: "8", Nine: "9", Jack: "J", Queen: "Q", King: "K"
};

function isRed( suit: CardSuit ) {
	return suit === "Hearts" || suit === "Diamonds";
}

export const DisplayCardSet = ( { cardSet }: { cardSet: CardSet } ) => {
	const cardSetPosition = cardSet.split( " " )[ 0 ];
	const cardSuit = cardSet.split( " " )[ 1 ] as CardSuit;

	return (
		<Box borderWidth={ 2 } p={ "$3" } borderRadius={ "$md" } borderColor={ "$borderDark100" }>
			<HStack gap={ "$3" } alignItems={ "center" }>
				<Heading color={ isRed( cardSuit ) ? "$red600" : "$gray800" } size={ "2xl" }>
					{ cardSetPosition.toUpperCase() }
				</Heading>
				<Image source={ { uri: suitSrcMap[ cardSuit ] } } alt={ cardSet } width={ 32 } height={ 32 }/>
			</HStack>
		</Box>
	);
};

export const DisplayCard = ( { card }: DisplayCardProps ) => (
	<Box
		borderWidth={ 2 }
		borderColor={ "$borderDark100" }
		borderRadius={ "$md" }
		alignItems={ "center" }
		w={ "$20" }
		h={ "$32" }
		justifyContent={ "center" }
	>
		<Heading color={ isRed( card.suit ) ? "$red600" : "$gray800" } size={ "3xl" } mb={ "$2" }>
			{ rankTextMap[ card.rank ] }
		</Heading>
		<Image source={ { uri: suitSrcMap[ card.suit ] } } alt={ card.id } width={ 28 } height={ 28 } mb={ "$2" }/>
	</Box>
);