import type { Team } from "@stairway/api/literature";
import { cn, fjalla } from "@stairway/components/base";

export type DisplayScoreProps = {
	team1?: Team;
	team2?: Team;
}

export function DisplayScore( { team1, team2 }: DisplayScoreProps ) {
	return (
		<div className={ "flex border-b-2 items-center" }>
			<div className={ "flex-1 p-3 flex flex-col items-center justify-center" }>
				<h2 className={ cn( "lg:text-4xl sm:text-3xl text-2xl", fjalla.className ) }>
					{ team1?.name.toUpperCase() }
				</h2>
			</div>
			<div className={ "p-3" }>
				<h2 className={ cn( "lg:text-6xl sm:text-4xl text-3xl", fjalla.className ) }>
					{ team1?.score }&nbsp;-&nbsp;{ team2?.score }
				</h2>
			</div>
			<div className={ "flex-1 p-3 flex flex-col items-center justify-center" }>
				<h2 className={ cn( "lg:text-4xl sm:text-3xl text-2xl", fjalla.className ) }>
					{ team2?.name.toUpperCase() }
				</h2>
			</div>
		</div>
	);
}