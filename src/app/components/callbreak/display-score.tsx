"use client";

import { store } from "@/app/components/callbreak/store";
import { Avatar, AvatarImage } from "@/app/primitives/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/primitives/table";
import { useStore } from "@tanstack/react-store";

export function DisplayScore() {
	const status = useStore( store, state => state.status );
	const deal = useStore( store, state => state.currentDeal );
	const scores = useStore( store, state => state.scores );

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
						{ status !== "GAME_COMPLETED" && (
							<TableHead className={ "text-center" }>ACTIVE DEAL</TableHead>
						) }
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
								{ scores[ player.id ].map( String ).join( ", " ) }
							</TableCell>
							<TableCell className={ "text-center" }>
								{ scores[ player.id ].reduce( ( sum, score ) => sum + score, 0 ) }
							</TableCell>
							{ status !== "GAME_COMPLETED" && !!deal && (
								<TableCell className={ "text-center" }>
									{ deal.wins[ player.id ] ?? 0 }&nbsp;/&nbsp;{ deal.declarations[ player.id ] ?? 0 }
								</TableCell>
							) }
						</TableRow>
					) ) }
				</TableBody>
			</Table>
		</div>
	);
}