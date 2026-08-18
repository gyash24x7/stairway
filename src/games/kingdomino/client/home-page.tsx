import { kingdominoApi } from "@/games/kingdomino/client/client.ts";
import { KingdominoCreateGame } from "@/games/kingdomino/client/create-game.tsx";
import { GameHomePage } from "@/swish/client/game-home-page.tsx";

export function KingdominoHomePage( props: { isLoggedIn?: boolean } ) {
	return (
		<GameHomePage
			game={ "kingdomino" }
			isLoggedIn={ props.isLoggedIn }
			createGame={ <KingdominoCreateGame/> }
			joinGame={ kingdominoApi.join }
			blurb={
				<>
					<p>
						Kingdomino is a tile-laying game for two to four players, designed by
						Bruno Cathala and first published in 2016. Each player builds a kingdom
						out of domino-shaped tiles, every one of them showing two terrain
						squares, and scores it by how large and how well-crowned their regions
						end up being.
					</p>
					<p>
						The tension is in the draft. Taking the tile you want also decides how
						early you pick next round, so a strong tile costs you the initiative
						and a weak one buys it back. Games are short, and the whole kingdom is
						public, so everyone can see the squeeze coming.
					</p>
				</>
			}
			rules={
				<>
					<p className={ "mb-5" }>
						Each player starts with a castle tile in the centre of their kingdom. A
						kingdom may never grow beyond the configured square — 5×5 in the
						standard game — measured across every tile placed, so the castle is not
						necessarily in the middle of the finished map.
					</p>
					<p className={ "mb-5" }>
						A round has two halves. First the draft is revealed: as many tiles as
						there are players, sorted from lowest number to highest. In turn order,
						each player claims one of them. Then, in the order those claims were
						made, each player places the tile they claimed in the previous round.
					</p>
					<p className={ "mb-5" }>
						A tile must be placed so that at least one of its two squares touches —
						orthogonally — either the castle or a square of matching terrain
						already in the kingdom. A player with no legal placement discards the
						tile instead, and scores nothing for it.
					</p>
					<p className={ "mb-5" }>
						Claiming decides the next round's order. The player who took the lowest
						numbered tile picks first next round, and the player who took the
						highest picks last. Low tiles are weak but fast; high tiles are strong
						but hand the initiative to everyone else.
					</p>
					<p className={ "mb-5" }>
						Scoring happens once, at the end. Each connected region of matching
						terrain is worth the number of squares in it multiplied by the number
						of crowns it contains. A region with no crowns scores nothing however
						large it is, which is what makes a single-square region with a crown on
						it worth more than a sprawling empty one.
					</p>
					<p className={ "mb-5" }>
						The highest total wins. Because crowns multiply rather than add, strong
						play is usually about concentrating crowns into the terrain you can
						actually grow, rather than chasing every crown on the board.
					</p>
				</>
			}
		/>
	);
}
