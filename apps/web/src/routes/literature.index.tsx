import { Separator } from "@base/components";
import { CreateGame, JoinGameDialog } from "@literature/components";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/literature/" )( {
	component: () => {
		const { authInfo } = Route.useRouteContext();
		const navigate = Route.useNavigate();

		const navigateFn = ( gameId: string ) => navigate( { to: "/literature/$gameId", params: { gameId } } );

		return (
			<div className={ "flex gap-5 flex-col mt-2" }>
				<h2 className={ "text-4xl font-fjalla" }>LITERATURE</h2>
				<p>
					Literature is a card game for 6 or 8 players in two teams using a
					shortened version of the standard 52-card pack. The game is sometimes
					called Fish or Canadian Fish, after the similar Go Fish, or Russian
					Fish. It is played in Tamil Nadu and Kerala in southern India and in
					parts of North America.
				</p>
				<Separator className={ "my-5" }/>
				{ !!authInfo ? (
					<div className={ "flex gap-5" }>
						<CreateGame navigate={ navigateFn }/>
						<JoinGameDialog/>
					</div>
				) : (
					<h2 className={ "text-2xl font-semibold" }>Login to Play!</h2>
				) }
				<Separator className={ "my-5" }/>
				<h2 className={ "text-xl font-semibold" }>RULES</h2>
				<p className={ "mb-5" }>
					The game is played by six or eight players in two teams. Six is best
					and is standard in the Canadian game. Players sit in alternating
					order. Four 8's are removed from a standard French-suited 52-card
					English pattern pack to leave 48 cards. There are thus eight
					half-suits of six cards each called sets or books such as "Lower
					Spades" (♠A ♠2 ♠3 ♠4 ♠5 ♠6 ) or "Upper Hearts" (♠8 ♥9 ♥10 ♥J
					♥Q ♥K).
				</p>
				<p className={ "mb-5" }>
					The objective is to win more books than the other team.
				</p>
				<p className={ "mb-5" }>
					Deal and play are assumed to be to the left i.e. clockwise. The first
					dealer is selected at random by e.g. drawing cards, highest deals.
					Dealer shuffles and deals all the cards out, individually and face
					down, beginning with the player to the dealer's immediate left. If six
					play, they will each receive 8 cards; if eight play, 6 cards. When the
					deal is finished players pick up and look at their own cards.
				</p>
				<p className={ "mb-5" }>
					Unusually, the dealer goes first. When it is a player's turn, the
					player may ask a question of any member of the opposing team as
					follows:
				</p>
				<div className={ "pl-2 mb-3" }>
					<p className={ "mb-2" }>
						A specific card must be requested e.g. "I would like the 8 of
						Spades"
					</p>
					<p className={ "mb-2" }>
						The player must hold a card that is part of the requested book
					</p>
					<p className={ "mb-2" }>The player asked must hold at least one card</p>
					<p className={ "mb-2" }>
						The player may not ask for a card already held
					</p>
					<p className={ "mb-2" }>The player may not ask a teammate for a card</p>
				</div>
				<p className={ "mb-5" }>
					Example: Anna only has one Diamond in her hand – the ♦J. She may ask
					for the ♦9, ♦10, ♦Q, ♦K or ♦8, but not the ♦J or any of the
					lower Diamonds.
				</p>
				<p className={ "mb-5" }>
					The called player must hand over the called card, face up, if held.
					The caller then has another turn and may ask another question of any
					desired opponent. If the called player does not have the called card,
					the turn ends and the called player has the next turn
				</p>
				<p className={ "mb-5" }>
					A player who has collected an entire book, can lay it down, face up,
					and win it for the team. If a book is split between team members, a
					player can claim it when it is that player's turn, by saying "Claim"
					and declaring the cards held by each team member. For example, George
					says:
				</p>
				<p className={ "mb-5" }>
					"Claim! Low Spades, I have the 4 and A, Mary has the 3, and Joseph has
					the 5, 6, and 2."
				</p>
				<p className={ "mb-5" }>
					The players holding those cards then reveal them and, if George is
					right, his team wins the book called "Low Spades". If he is wrong
					because an opponent holds one of the cards, the opposing team wins the
					book. If his team holds the whole book, but George gets the
					distribution wrong because Mary has the 3 and 2 and Joseph has 5 and
					6, then the book is forfeited and opposite team scores for it.
				</p>
				<p className={ "mb-5" }>
					A player does not need to hold any of the book in order to make a
					claim. A won book is stacked in front of a member of the winning team.
					At any stage a player may ask what the last question and answer was,
					but no information about earlier ones may be discussed. Players may
					ask how many cards another player has. They may not keep any written
					records about the game.
				</p>
			</div>
		);
	}
} );
