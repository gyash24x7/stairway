"use client";

import { CreateGame } from "@/shared/components/create-game";
import { cn } from "@/shared/utils/cn";
import { createGame } from "@/splendor/core/actions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

export function SplendorCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<2 | 3 | 4>();
	const [ winningPoints, setWinningPoints ] = useState( 15 );
	const createGameFn = useServerFn( createGame );

	const createSplendorGame = async () => {
		if ( !!playerCount && !!winningPoints ) {
			return createGameFn( { data: { playerCount, winningPoints } } );
		}
		return "";
	};

	return (
		<CreateGame game={ "splendor" } disabled={ !playerCount } createGame={ createSplendorGame }>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Player Count</label>
				<div className={ "flex gap-3 flex-wrap" }>
					{ ( [ 2, 3, 4 ] as const ).map( ( item ) => (
						<div
							key={ item }
							onClick={ () => setPlayerCount( playerCount === item ? undefined : item ) }
							className={ cn(
								playerCount === item ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
								"hover:bg-background border-gray-400"
							) }
						>
							{ item }
						</div>
					) ) }
				</div>

				<label className={ "text-sm text-muted-foreground" }>Winning Points</label>
				<div className={ "flex gap-3 flex-wrap" }>
					{ [ 10, 15, 20 ].map( ( points ) => (
						<div
							key={ points }
							onClick={ () => setWinningPoints( points ) }
							className={ cn(
								winningPoints === points ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
								"hover:bg-background border-gray-400"
							) }
						>
							{ points }
						</div>
					) ) }
				</div>
			</div>
		</CreateGame>
	);
}
