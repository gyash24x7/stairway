"use client";

import { createGame } from "@/fish/core/actions";
import type { BookType } from "@/fish/core/types";
import { CreateGame } from "@/shared/components/create-game";
import { cn } from "@/shared/utils/cn";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

export function FishCreateGame() {
	const createGameFn = useServerFn( createGame );
	const [ playerCount, setPlayerCount ] = useState<4 | 6 | 8>();
	const [ teamCount, setTeamCount ] = useState<2 | 3 | 4>();
	const [ bookType, setBookType ] = useState<BookType>( "NORMAL" );

	const createFishGame = async () => {
		if ( !!playerCount && !!teamCount ) {
			return createGameFn( { data: { playerCount, type: bookType, teamCount } } );
		}
		return "";
	};

	return (
		<CreateGame game={ "fish" } disabled={ !playerCount } createGame={ createFishGame }>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Player Count</label>
				<div className={ "flex gap-3 flex-wrap" }>
					{ ( [ 4, 6, 8 ] as const ).map( ( item ) => (
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

				<label className={ "text-sm text-muted-foreground" }>Team Count</label>
				<div className={ "flex gap-3 flex-wrap" }>
					{ ( [ 2, 3, 4 ] as const ).map( ( item ) => (
						<div
							key={ item }
							onClick={ () => setTeamCount( item === teamCount ? undefined : item ) }
							className={ cn(
								teamCount === item ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
								"hover:bg-background border-gray-400"
							) }
						>
							{ item }
						</div>
					) ) }
				</div>

				<label className={ "text-sm text-muted-foreground" }>Game Type</label>
				<div className={ "flex gap-3 flex-wrap" }>
					{ ( [ "NORMAL", "CANADIAN" ] as const ).map( ( item ) => (
						<div
							key={ item }
							onClick={ () => setBookType( item ) }
							className={ cn(
								bookType === item ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
								"hover:bg-background border-gray-400"
							) }
						>
							{ item }
						</div>
					) ) }
				</div>
			</div>
		</CreateGame>
	);
}
