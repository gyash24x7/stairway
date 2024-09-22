import { useCardCounts, usePlayers, useTeams } from "@literature/store";
import { useMemo } from "react";
import { DisplayPlayerWithCardCount } from "./display-player.tsx";

export const DisplayTeams = () => {
	const players = usePlayers();
	const teams = useTeams();
	const cardCounts = useCardCounts();
	const teamList = useMemo( () => Object.values( teams ), [ teams ] );

	return (
		<div className={ "flex flex-col border-2 border-gray-300 rounded-md" }>
			<div className={ "flex border-b-2 border-b-gray-300" }>
				<div className={ "flex-1 p-3 flex items-center justify-center" }>
					<h2 className={ "text-4xl font-fjalla" }>{ teamList[ 0 ]?.name.toUpperCase() }</h2>
				</div>
				<div className={ "p-3" }>
					<h2 className={ "text-6xl font-fjalla" }>
						{ teamList[ 0 ]?.score } - { teamList[ 1 ]?.score }
					</h2>
				</div>
				<div className={ "flex-1 p-3 flex items-center justify-center" }>
					<h2 className={ "text-4xl font-fjalla" }>{ teamList[ 1 ]?.name.toUpperCase() }</h2>
				</div>
			</div>
			<div className={ "flex" }>
				<div className={ "w-full py-2 border-r-2 border-r-gray-300 flex flex-wrap" }>
					{ teamList[ 0 ]?.memberIds.map( playerId => (
						<DisplayPlayerWithCardCount
							player={ players[ playerId ] }
							key={ playerId }
							cardCount={ cardCounts[ playerId ] }
						/>
					) ) }
				</div>
				<div className={ "w-full py-2 flex flex-wrap" }>
					{ teamList[ 1 ]?.memberIds.map( playerId => (
						<DisplayPlayerWithCardCount
							player={ players[ playerId ] }
							key={ playerId }
							cardCount={ cardCounts[ playerId ] }
						/>
					) ) }
				</div>
			</div>
		</div>
	);
};