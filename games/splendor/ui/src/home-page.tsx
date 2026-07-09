import { client } from "@s2h/client";
import { JoinGame } from "@s2h/ui/components/join-game";
import type { JoinGameInput } from "@s2h/engine/types";
import { useAuth } from "@s2h/ui/hooks/use-auth";
import { Separator } from "@s2h/ui/primitives/separator";
import { cn } from "@s2h/shared/utils/cn";
import { SplendorCreateGame as CreateGame } from "./create-game";

export function SplendorHomePage() {
	const { authInfo } = useAuth();
	const joinGame = ( input: JoinGameInput ) => client.splendor.joinGame( input );
	return (
		<div
			className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
			<h2 className={ cn( "text-4xl font-heading" ) }>SPLENDOR</h2>
			<p>
				Splendor is a fast-paced engine-building game for two to four
				players, designed by Marc André and first published in 2014. Players
				take on the role of Renaissance merchants, collecting gem tokens to
				purchase development cards that grant permanent gem discounts and
				prestige points.
			</p>
			<p>
				The first player to reach fifteen prestige points triggers the final
				round, after which the player with the highest score wins. Despite
				its short rulebook, Splendor offers deep tactical decisions around
				resource conversion, card timing, and competing with opponents for
				the same goals.
			</p>
			<Separator/>
			{ !!authInfo
				? (
					<div className={ "grid grid-cols-1 md:grid-cols-2 gap-5 w-full" }>
						<CreateGame/>
						<JoinGame game={ "splendor" } joinGame={ joinGame }/>
					</div>
				)
				: (
					<div className={ "flex gap-5 w-full" }>
						<div className={ "text-lg text-center" }>Please log in to play.</div>
					</div>
				)
			}
			<Separator/>
			<h2 className={ "text-xl font-semibold" }>RULES</h2>
			<p className={ "mb-5" }>
				Splendor is played with five types of gem tokens — emerald (green),
				sapphire (blue), ruby (red), diamond (white), and onyx (black) — plus
				a sixth wild token, gold. Development cards are arranged in three
				levels of increasing cost and prestige, with four cards from each
				level revealed face-up on the table. Noble tiles are placed alongside
				the cards: there is always one more noble than there are players.
			</p>
			<p className={ "mb-5" }>
				The objective is to be the first player to reach fifteen prestige
				points. Points come from purchased development cards and from any
				nobles a player has attracted. Once any player reaches fifteen
				points, the current round is finished so that all players have taken
				the same number of turns, and then the highest score wins.
			</p>
			<p className={ "mb-5" }>
				On each turn, a player must perform exactly one of the following
				actions:
			</p>
			<div className={ "pl-2 mb-3" }>
				<p className={ "mb-2" }>
					Take three gem tokens of three different colours (gold cannot be
					chosen this way)
				</p>
				<p className={ "mb-2" }>
					Take two gem tokens of the same colour, but only if at least four
					tokens of that colour remain in the supply
				</p>
				<p className={ "mb-2" }>
					Reserve a single development card by placing it in your hand and,
					if available, taking one gold token as a wild
				</p>
				<p className={ "mb-2" }>
					Purchase a face-up card or a card you previously reserved by paying
					its cost in gem tokens
				</p>
			</div>
			<p className={ "mb-5" }>
				A player may never hold more than ten gem tokens in total. If a turn
				would leave you over the limit, you must immediately return tokens of
				your choice back to the supply until you are back at ten.
			</p>
			<p className={ "mb-5" }>
				A player may have at most three reserved cards in hand at any time.
				Reserved cards remain hidden from opponents until they are purchased.
				Reserving is a useful way to secure a high-value card before an
				opponent buys it, or to claim a gold token when the supply allows.
			</p>
			<p className={ "mb-5" }>
				Each development card has a cost printed in gems and produces a
				permanent bonus of one gem colour. Bonuses act as discounts on future
				purchases — a card that produces ruby reduces every future cost in
				rubies by one, regardless of whether you still have ruby tokens. Gold
				tokens are wild and can substitute for any single gem when paying a
				cost; tokens spent on a purchase are returned to the supply.
			</p>
			<p className={ "mb-5" }>
				Higher-level cards cost more but award more prestige points. Level I
				cards typically grant zero or one point, Level II cards offer
				moderate points, and Level III cards offer the highest values. Most
				cards, especially at Level I, are valuable mainly for their
				discounts, helping a player accelerate later purchases.
			</p>
			<p className={ "mb-5" }>
				At the end of any turn in which the player meets the requirements
				printed on a noble tile (a fixed number of cards of each listed gem
				colour, counted by their bonuses), that noble visits the player and
				is taken immediately, awarding three prestige points. If multiple
				nobles can visit on the same turn, only one of them does — the
				player chooses which.
			</p>
			<p className={ "mb-5" }>
				Strong play in Splendor balances short-term gains with long-term
				engine building. Early Level I cards expand the gem economy and lay
				the groundwork for cheaper big purchases later. Tracking which
				cards your opponents are likely chasing — and timing your reserves
				accordingly — is often the difference between victory and a turn
				spent reacting.
			</p>
		</div>
	);
}
