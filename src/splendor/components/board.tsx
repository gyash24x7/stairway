"use client";

import { cn } from "@/shared/utils/cn";
import { CardActions } from "@/splendor/components/card-actions";
import { useSplendor } from "@/splendor/components/context";
import { GameCardBack } from "@/splendor/components/game-card";
import { Noble, NobleBack } from "@/splendor/components/noble";

export function Board() {
	const { match } = useSplendor();
	return (
		<div className={ "flex flex-col gap-3 w-full" }>
			<div className={ cn( "flex gap-2 items-center justify-between bg-background p-3 rounded-md" ) }>
				<div className={ "hidden md:block" }>
					<NobleBack/>
				</div>
				{ match.state.data.nobles.map(
					noble => <Noble noble={ noble } key={ noble.id }/>
				) }
				{ new Array( match.config.playerCount + 1 - match.state.data.nobles.length ).fill( 0 )
					.map( ( _, i ) => (
						<div
							key={ `empty-noble-${ i }` }
							className={ cn(
								"w-16 md:w-20 h-16 md:h-20 rounded-md",
								"border-2 border-dashed border-gray-300"
							) }
						/>
					) ) }
			</div>
			<div className={ "flex flex-col gap-2 bg-background p-3 rounded-md" }>
				{ [ 3 as const, 2 as const, 1 as const ].map( level => (
					<div className={ "flex gap-2 items-center justify-between w-full" } key={ level }>
						<div className={ "hidden md:block" }>
							<GameCardBack level={ level }/>
						</div>
						{ match.state.data.cards[ level ].map(
							card => <CardActions card={ card } key={ card.id }/>
						) }
						{ Array.from( { length: 4 - match.state.data.cards[ level ].length } ).map( ( _, i ) => (
							<div
								key={ `empty-${ level }-${ i }` }
								className={ cn(
									"w-16 md:w-20 h-24 md:h-30 rounded-md",
									"border-2 border-dashed border-gray-300"
								) }
							/>
						) ) }
					</div>
				) ) }
			</div>
		</div>
	);
}