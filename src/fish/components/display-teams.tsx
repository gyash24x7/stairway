"use client";

import { store } from "@/fish/store";
import { useStore } from "@tanstack/react-store";

export function DisplayTeams() {
	const players = useStore( store, state => state.players );
	const teams = useStore( store, state => Object.values( state.teams )
		.toSorted( ( a, b ) => a.id.localeCompare( b.id ) ) );

	const getFirstName = ( name: string ) => {
		return name.split( " " )[ 0 ].toUpperCase();
	};

	return (
		<div className={ "flex flex-col border-2 rounded-md" }>
			{ teams.map( team => (
				<div>
					<div>
						<h2 className={ "lg:text-4xl sm:text-3xl text-2xl" }>
							{ team.name.toUpperCase() }
						</h2>
						<div className={ "w-full p-2 border-r-2 text-xs md:text-md text-left" }>
							{ team.players.map( playerId => getFirstName( players[ playerId ].name ) ).join( ", " ) }
						</div>
					</div>
					<div>
						<h2 className={ "lg:text-6xl sm:text-4xl text-3xl" }>
							{ team.score }
						</h2>
					</div>
				</div>
			) ) }
		</div>
	);
}