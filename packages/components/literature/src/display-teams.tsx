import { usePlayers, useTeams } from "@stairway/stores/literature";
import { useMemo } from "react";
import { DisplayScore } from "./display-score.tsx";

export const DisplayTeams = () => {
	const players = usePlayers();
	const teams = useTeams();
	const teamList = useMemo(
		() => Object.values( teams ).toSorted( ( a, b ) => a.id.localeCompare( b.id ) ),
		[ teams ]
	);

	return (
		<div className={ "flex flex-col border-2 rounded-md" }>
			<DisplayScore team1={ teamList[ 0 ] } team2={ teamList[ 1 ] }/>
			<div className={ "flex" }>
				<div className={ "w-full p-2 border-r-2 text-xs lg:text-md text-left" }>
					{ teamList[ 0 ]?.memberIds.map( playerId => players[ playerId ].name ).join( ", " ) }
				</div>
				<div className={ "w-full p-2 text-xs lg:text-md text-right" }>
					{ teamList[ 1 ]?.memberIds.map( playerId => players[ playerId ].name ).join( ", " ) }
				</div>
			</div>
		</div>
	);
};