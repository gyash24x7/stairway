import { CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";
import Spades from "../assets/suits/spades.png";
import Clubs from "../assets/suits/clubs.png";
import Diamonds from "../assets/suits/diamonds.png";
import Hearts from "../assets/suits/hearts.png";

export interface DisplayCardProps {
	card: PlayingCard;
}

export const suitSrcMap: Record<CardSuit, string> = {
	"Clubs": Clubs,
	"Spades": Spades,
	"Hearts": Hearts,
	"Diamonds": Diamonds
};

export const cardSetSrcMap: Record<CardSet, string> = {
	"Big Clubs": Clubs,
	"Big Diamonds": Diamonds,
	"Big Hearts": Hearts,
	"Big Spades": Spades,
	"Small Clubs": Clubs,
	"Small Diamonds": Diamonds,
	"Small Hearts": Hearts,
	"Small Spades": Spades
};

export const rankTextMap: Record<CardRank, string> = {
	Ace: "A", Two: "2", Ten: "10", Three: "3", Five: "5", Four: "4", Seven: "7", Six: "6",
	Eight: "8", Nine: "9", Jack: "J", Queen: "Q", King: "K"
};

export function DisplayCard( { card }: DisplayCardProps ) {

	const colorClass = card.suit === CardSuit.SPADES || card.suit === CardSuit.CLUBS ? "text-dark-700" : "text-danger";

	return (
		<div className = { "border border-light-700 rounded rounded-lg bg-light-100 h-24 w-16 pl-2 pt-1m king-yna-bg" }>
			<h2 className = { `font-fjalla text-3xl ${ colorClass }` }>{ rankTextMap[ card.rank ] }</h2>
			<img src = { suitSrcMap[ card.suit ] } alt = { card.id } width = { 16 } height = { 16 }/>
		</div>
	);

}