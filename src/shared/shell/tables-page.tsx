import { RequireSession } from "@/auth/ui/require-session";
import { OpenTables } from "@/lobby/ui/open-tables";
import { Separator } from "@/shared/primitives/separator";


/**
 * The page behind `/tables`: every open table, across every game.
 *
 * The navbar has pointed here since before there was a lobby to point at, which
 * is the one thing this page is for — a player who wants a game but does not
 * much mind which should not have to guess which of seven home pages somebody
 * happens to be waiting on.
 *
 * It is `OpenTables` with no game to narrow by, so each row names its own game
 * and links into that game's join page.
 */
export function TablesPage() {
	return (
		<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
			<h2 className={ "text-4xl font-heading" }>OPEN TABLES</h2>
			<p>
				Games waiting for players, across every game on Stairway. Take a seat at
				any of them, or open your own from that game's page.
			</p>
			<Separator/>
			<RequireSession>
				<OpenTables className={ "max-w-full" }/>
			</RequireSession>
		</div>
	);
}
