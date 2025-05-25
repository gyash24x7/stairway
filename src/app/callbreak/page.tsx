import { getAuthInfo } from "@/auth/server/functions";
import { CreateGame } from "@/callbreak/components/create-game";
import { JoinGame } from "@/callbreak/components/join-game";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@/shared/utils/cn";
import { fjalla } from "@/shared/utils/fonts";

export default async function CallbreakHome() {
	const authInfo = await getAuthInfo();
	return (
		<div className={ "flex gap-5 flex-col mt-2" }>
			<h2 className={ cn( "text-4xl", fjalla.className ) }>CALLBREAK</h2>
			<p>
				CallBreak is a thrilling card game enjoyed by many, particularly in India.
				It is a type of trick taking game where points are calculated based on the
				number of rounds the player has won.
			</p>
			<Separator className={ "my-5" }/>
			{ !!authInfo ? (
				<div className={ "flex gap-5" }>
					<CreateGame/>
					<JoinGame/>
				</div>
			) : (
				<h2 className={ "text-2xl font-semibold" }>Login to Play!</h2>
			) }
			<Separator className={ "my-5" }/>
			<h2 className={ "text-xl font-semibold" }>RULES</h2>
			<p className={ "mb-5" }>
				The game is played by four players. A standard deck of 52 cards is
				used. Before the game is started, the trump suit and the number of deals
				to be played in the game is decided. Number of Deals can be 5, 9 or 13.
				Each deal has 13 rounds.
			</p>
			<p className={ "mb-5" }>
				At the beginning of the deal, after the cards are dealt, each player
				declares the number of rounds he would win. At the end of the 13 rounds
				of the deal, the number of wins are calculated and points are given.
				At the end of all the deals, the player with highest points wins.
				Minimum of 2 wins are to be declared by the player.
			</p>
			<p className={ "mb-5" }>
				Points are calculated as follows:

				A player declares that he would win 4 rounds. If the player wins exactly
				4 wins, he get +40 for that deal. If he wins less than 4 rounds, he gets
				-40 points. If he wins more than 4 rounds, he get +40 points and +2 for
				extra win. Say, if he wins 6 rounds, he'll get +44 points.
			</p>
			<p className={ "mb-5" }>
				The player beginning the round can play any card. The next player has
				to play a bigger card than the cards already played of the same suit.
				If the player doesn't have bigger card, he can play any small card of
				the same suit. If the player doesn't have any card of that suit, he has
				to use a card of trump suit. If a card of trump suit is already played
				then he has tp play a bigger trump. If he doesn't have a bigger trump he
				can play any card.
			</p>
		</div>
	);
}