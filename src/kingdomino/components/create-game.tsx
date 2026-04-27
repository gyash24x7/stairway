"use client";

import { createGame } from "@/kingdomino/core/actions";
import type { BoardSize } from "@/kingdomino/core/types";
import { CreateGame } from "@/shared/components/create-game";
import { cn } from "@/shared/utils/cn";
import { useState } from "react";

export function KingdominoCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<2 | 3 | 4>();
	const [ boardSize, setBoardSize ] = useState<BoardSize>();

	const createKingdominoGame = async () => {
		if ( !!playerCount && !!boardSize ) {
			return createGame( { playerCount, boardSize } );
		}
		return "";
	};

	const handlePlayerCountClick = ( item: 2 | 3 | 4 ) => () => setPlayerCount(
		playerCount === item ? undefined : item
	);

	return (
		<CreateGame
			game={ "kingdomino" }
			disabled={ !playerCount || !boardSize }
			createGame={ createKingdominoGame }
		>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>
					Player Count
				</label>
				<div className={ "flex gap-3 flex-wrap" }>
					{ ( [ 2, 3, 4 ] as const ).map( ( item ) => (
						<div
							key={ item }
							onClick={ handlePlayerCountClick( item ) }
							className={ cn(
								playerCount === item ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2",
								"flex justify-center hover:bg-background border-inverted-surface"
							) }
						>
							{ item }
						</div>
					) ) }
				</div>

				<label className={ "text-sm text-muted-foreground" }>
					Board&nbsp;Size
				</label>
				<div className={ "flex gap-3 flex-wrap" }>
					{ [ 5 as const, 7 as const ].map( ( size ) => (
						<div
							key={ size }
							onClick={ () => setBoardSize( size ) }
							className={ cn(
								boardSize === size ? "bg-background" : "bg-surface",
								"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
								"hover:bg-background border-inverted-surface"
							) }
						>
							{ size }
						</div>
					) ) }
				</div>
			</div>
		</CreateGame>
	);
}
