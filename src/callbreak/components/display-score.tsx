"use client";

import { store } from "@/callbreak/store";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/primitives/table";
import { useStore } from "@tanstack/react-store";

export function DisplayScore() {
	const status = useStore( store, state => state.game.status );
	const deal = useStore( store, state => state.currentDeal );
	const scoresByPlayer: Record<string, number[]> = useStore( store, state => {
		const scores: Record<string, number[]> = {};
		Object.keys( state.players ).forEach( playerId => {
			if ( !scores[ playerId ] ) {
				scores[ playerId ] = [];
			}

			scores[ playerId ].push( ...state.game.scores.toReversed().map( dealScore => dealScore[ playerId ] ) );
		} );
		return scores;
	} );

	const playerList = useStore( store, state => Object.values( state.players ).toSorted(
		( a, b ) => a.id.localeCompare( b.id )
	) );

	return (
		<div className={ "flex flex-col gap-3 rounded-md p-3 border-2" }>
			<p>SCORES</p>
			<Table>
				<TableHeader>
					<TableRow className={ "bg-white text-md" }>
						<TableHead>PLAYER</TableHead>
						<TableHead className={ "hidden md:table-cell text-center" }>PREVIOUS DEALS</TableHead>
						<TableHead className={ "text-center" }>SCORE</TableHead>
						{ status !== "COMPLETED" && <TableHead className={ "text-center" }>ACTIVE DEAL</TableHead> }
					</TableRow>
				</TableHeader>
				<TableBody>
					{ playerList.map( ( player ) => (
						<TableRow key={ player.id }>
							<TableCell className={ "flex gap-2 items-center" }>
								<Avatar className={ "rounded-full w-7 h-7 hidden sm:block" }>
									<AvatarImage src={ player.avatar } alt={ "" }/>
								</Avatar>
								<h2 className={ "font-semibold" }>{ player.name.toUpperCase() }</h2>
							</TableCell>
							<TableCell className={ "hidden md:table-cell text-center" }>
								{ scoresByPlayer[ player.id ].map( String ).join( ", " ) }
							</TableCell>
							<TableCell className={ "text-center" }>
								{ scoresByPlayer[ player.id ].reduce( ( sum, score ) => sum + score, 0 ) }
							</TableCell>
							{ status !== "COMPLETED" && (
								<TableCell className={ "text-center" }>
									{ deal?.wins[ player.id ] ??
										0 }&nbsp;/&nbsp;{ deal?.declarations[ player.id ] ?? 0 }
								</TableCell>
							) }
						</TableRow>
					) ) }
				</TableBody>
			</Table>
		</div>
	);
}