import { cn } from "cn";

import type { FishConfig, FishView } from "@/games/fish/schema";
import { claimsOf, getTeamScores } from "@/games/fish/utils";
import type { GameView, PlayerId, TeamId } from "@/swish/schema";
import { RPlayerInfoStrip } from "@/swish/ui/player-info";
import { membersOf, nameOf, teamOf } from "@/swish/utils";


type Game = GameView<FishView, FishConfig>;

function PlayerWithCardCount( { game, playerId }: { game: Game; playerId: PlayerId } ) {
	const player = game.players[ playerId ];
	const cardCount = game.view.cardCounts[ playerId ] ?? 0;
	const isActive = playerId === game.context.currentPlayer;

	if ( !player ) {
		return null;
	}

	return (
		<div
			className={ cn(
				"flex gap-1 md:gap-2 items-center rounded-md px-2 py-1",
				isActive && "bg-accent/20"
			) }
		>
			<RPlayerInfoStrip player={ player }/>
			<span
				className={ cn(
					"text-xs md:text-sm font-bold px-2 py-0.5 rounded-full",
					cardCount > 0 ? "bg-accent text-neutral-dark" : "bg-neutral-400 text-white"
				) }
			>
				{ cardCount }
			</span>
		</div>
	);
}

export type TeamsViewProps = {
	readonly game: Game;
	readonly me: PlayerId;
};

/**
 * Every side at the table, with its books.
 *
 * The scores are folded out of the declarations rather than read off the view:
 * every declaration takes its book out of play and `getBookWinner` says which
 * side it went to, so the same derivation the engine scores with runs here on
 * the same public history.
 */
export function TeamsView( { game, me }: TeamsViewProps ) {
	const scores = getTeamScores( claimsOf( game.view ), game.context, game.config.teams );
	const myTeam = teamOf( game.context, me );

	const label = ( team: TeamId, index: number ) =>
		nameOf( game.context, team ) ?? `TEAM ${ index + 1 }`;

	return (
		<div className={ "grid grid-cols-1 gap-2 w-full" }>
			{ game.config.teams.map( ( team, index ) => (
				<div
					key={ team }
					className={ cn(
						"bg-background rounded-md p-2 md:p-3 flex flex-col gap-3",
						myTeam === team && "border-2 border-accent"
					) }
				>
					<div className={ "flex items-baseline justify-between" }>
						<div className={ "text-2xl md:text-4xl uppercase font-heading pr-16 truncate" }>
							{ label( team, index ) }
						</div>
						<div className={ "gap-3 flex-wrap flex-1 hidden md:flex" }>
							{ membersOf( game.context, team ).map( pid => (
								<PlayerWithCardCount game={ game } playerId={ pid } key={ pid }/>
							) ) }
						</div>
						<div className={ "text-2xl md:text-4xl font-heading pl-8" }>
							{ scores[ team ] ?? 0 }
						</div>
					</div>
					<div className={ "md:hidden flex w-full gap-1 flex-wrap" }>
						{ membersOf( game.context, team ).map( pid => (
							<PlayerWithCardCount game={ game } playerId={ pid } key={ pid }/>
						) ) }
					</div>
				</div>
			) ) }
		</div>
	);
}
