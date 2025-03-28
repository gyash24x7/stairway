"use client";

import { DisplayScore } from "@/components/literature/display-score";
import { store } from "@/stores/literature";
import { useStore } from "@tanstack/react-store";

export function DisplayTeams() {
	const players = useStore( store, state => state.players );
	const teams = useStore( store, state => Object.values( state.teams )
		.toSorted( ( a, b ) => a.id.localeCompare( b.id ) ) );

	return (
		<div className={ "flex flex-col border-2 rounded-md" }>
			<DisplayScore team1={ teams[ 0 ] } team2={ teams[ 1 ] }/>
			<div className={ "flex" }>
				<div className={ "w-full p-2 border-r-2 text-xs lg:text-md text-left" }>
					{ teams[ 0 ]?.memberIds.map( playerId => players[ playerId ].name ).join( ", " ) }
				</div>
				<div className={ "w-full p-2 text-xs lg:text-md text-right" }>
					{ teams[ 1 ]?.memberIds.map( playerId => players[ playerId ].name ).join( ", " ) }
				</div>
			</div>
		</div>
	);
}