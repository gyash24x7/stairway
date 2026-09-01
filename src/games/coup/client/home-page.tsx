import { coupApi } from "@/games/coup/client/client.ts";
import { CoupCreateGame } from "@/games/coup/client/create-game.tsx";
import { GameHomePage } from "@/swish/client/game-home-page.tsx";

export function CoupHomePage( props: { isLoggedIn?: boolean } ) {
	return (
		<GameHomePage
			game={ "coup" }
			isLoggedIn={ props.isLoggedIn }
			createGame={ <CoupCreateGame/> }
			joinGame={ coupApi.join }
			blurb={
				<>
					<p>
						Coup is a game of bluffing and deduction for three to six players,
						designed by Rikki Tahta and first published in 2012. Each player
						holds two face-down character cards — their influence — and the last
						player still holding one wins.
					</p>
					<p>
						What makes Coup unusual is that nothing stops you claiming a
						character you do not have. Every powerful action belongs to somebody
						at the table, but the game never checks whether it is you until
						another player is willing to bet an influence that you are lying.
					</p>
				</>
			}
			rules={
				<>
					<p className={ "mb-5" }>
						The deck holds fifteen cards: three copies each of the Duke, the
						Assassin, the Captain, the Ambassador and the Contessa. Every player
						is dealt two of them face down and takes two coins. Your two cards
						are your influence, and losing both puts you out of the game. The
						last player left holding influence wins.
					</p>
					<p className={ "mb-5" }>
						On your turn you take exactly one action. Three of them belong to
						nobody and cannot be challenged:
					</p>
					<div className={ "pl-2 mb-3" }>
						<p className={ "mb-2" }>Income — take one coin</p>
						<p className={ "mb-2" }>
							Foreign Aid — take two coins, unless somebody claims the Duke to
							stop you
						</p>
						<p className={ "mb-2" }>
							Coup — pay seven coins and force a player to give up an influence.
							Nothing can stop a coup
						</p>
					</div>
					<p className={ "mb-5" }>
						The other four claim a character. You may take them whether or not
						you hold the card:
					</p>
					<div className={ "pl-2 mb-3" }>
						<p className={ "mb-2" }>Tax, as the Duke — take three coins</p>
						<p className={ "mb-2" }>
							Assassinate, as the Assassin — pay three coins and force a player
							to give up an influence
						</p>
						<p className={ "mb-2" }>
							Steal, as the Captain — take two coins from another player
						</p>
						<p className={ "mb-2" }>
							Exchange, as the Ambassador — draw two cards from the deck, keep
							any of them, and put two back
						</p>
					</div>
					<p className={ "mb-5" }>
						Any player may challenge a claimed character. If the claimant holds
						the card, they reveal it, the challenger loses an influence, and the
						revealed card is shuffled back into the deck and replaced — so it
						costs the claimant nothing but proves what they had. If they do not
						hold it, they lose an influence and the action does not happen.
					</p>
					<p className={ "mb-5" }>
						Some actions can also be blocked. Foreign aid is blocked by the Duke,
						and any player may do it. An assassination is blocked by the
						Contessa, and stealing by either the Captain or the Ambassador — in
						both cases only the target may block. A block is itself a claim, so
						it can be challenged in turn.
					</p>
					<p className={ "mb-5" }>
						That last rule is where the game gets sharp. If you block an
						assassination with a Contessa you do not have and somebody calls it,
						you lose an influence for the bluff and the assassination still
						goes through — which can take both of your cards in a single turn.
						Challenging is just as dangerous in the other direction: doubting an
						honest claim costs you an influence and hands your opponent a fresh
						card.
					</p>
					<p className={ "mb-5" }>
						If you ever start your turn holding ten or more coins, you must
						launch a coup. There is no sitting on a pile.
					</p>
					<p className={ "mb-5" }>
						A card you lose is shown to the table and then shuffled back into
						the deck. Nothing stays face up, so every character remains in play
						all game and no claim is ever provably a bluff — the most you can
						ever know is what is in your own hand. Holding two copies of a
						character leaves exactly one unaccounted for, which makes somebody
						else claiming it a poor bet worth calling.
					</p>
				</>
			}
		/>
	);
}
