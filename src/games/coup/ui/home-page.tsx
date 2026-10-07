import { useAuth } from "@/auth/ui/use-auth";
import { CoupCreateGame } from "@/games/coup/ui/create-game";
import { GameHomePage } from "@/swish/ui/game-home-page";


export function CoupHomePage() {
	const user = useAuth();
	return (
		<GameHomePage
			game={ "coup" }
			isLoggedIn={ !!user }
			createGame={ <CoupCreateGame/> }
			blurb={
				<>
					<p>
						Coup is a game of bluff and deduction set in a city of scheming
						nobles. Every player starts with two face-down influence cards and two
						coins, and the last player still holding an influence wins. There is
						no board and no luck to speak of — only what you claim to be, and
						whether anybody believes you.
					</p>
					<p>
						The trick is that nothing checks your cards. You may claim any
						character on any turn, whether or not you hold it, and the claim
						simply happens unless somebody at the table calls you a liar. Getting
						caught costs you an influence; calling wrongly costs the challenger
						one.
					</p>
				</>
			}
			rules={
				<>
					<p className={ "mb-5" }>
						Each player is dealt two influence cards from a deck of twenty —
						four copies each of the Duke, Assassin, Captain, Ambassador and
						Contessa — and starts with two coins. Your cards stay face down.
						Losing an influence means giving one up: you choose which, and it goes
						back into the deck, which is reshuffled. Nobody else ever learns what
						it was, and it may well be drawn again. Losing both puts you out.
					</p>
					<p className={ "mb-5" }>
						On your turn you take exactly one action. Two of them are nobody&apos;s
						business: Income takes one coin, and a Coup costs seven coins and
						removes an influence from a player of your choice. A Coup cannot be
						blocked or challenged by anyone. At ten coins or more you may do
						nothing but Coup.
					</p>
					<p className={ "mb-5" }>
						Foreign Aid takes two coins and claims no character, so it cannot be
						challenged — but anyone may stop it by claiming a Duke, and that claim
						can be challenged in turn.
					</p>
					<p className={ "mb-5" }>
						The remaining four actions rest on a character you claim to hold:
					</p>
					<div className={ "mb-3 pl-2" }>
						<p className={ "mb-2" }>Duke — Tax: take three coins</p>
						<p className={ "mb-2" }>
							Assassin — Assassinate: pay three coins to remove an influence.
							The Contessa blocks it, and the coins are spent either way
						</p>
						<p className={ "mb-2" }>
							Captain — Steal: take two coins from another player. A Captain or
							an Ambassador blocks it
						</p>
						<p className={ "mb-2" }>
							Ambassador — Exchange: draw two from the deck, then put any two
							back. Your hand changes size not at all
						</p>
					</div>
					<p className={ "mb-5" }>
						Any claim — an action or a block — may be challenged by anybody it
						affects. If the claimant holds the character, they show it, shuffle it
						back into the deck and draw a replacement, and the challenger loses an
						influence. If they do not, they lose one instead. Proving a claim
						therefore tells the table what you held a moment ago and nothing at
						all about what you hold now.
					</p>
					<p className={ "mb-5" }>
						Because every claim is optional to contest, the game is played in the
						gap between them, and here there is nothing to count: a surrendered card
						goes back into the deck unseen, so nobody can ever cross a character off.
						What you have is the cards in your own hand, how many influences each
						player has left, and how often somebody has claimed the same character.
					</p>
					<p className={ "mb-5" }>
						The last player with an influence still face down wins. Players
						eliminated earlier are ranked by how long they lasted.
					</p>
				</>
			}
		/>
	);
}
