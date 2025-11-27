import { Avatar, AvatarImage } from "@s2h-ui/primitives/avatar";
import { Table, TableBody, TableCell, TableRow } from "@s2h-ui/primitives/table";
import { useStore } from "@tanstack/react-store";
import { store } from "./store";

export function DisplayTeams() {
	const players = useStore( store, state => state.players );
	const teams = useStore( store, state => Object.values( state.teams )
		.toSorted( ( a, b ) => a.id.localeCompare( b.id ) ) );

	return (
		<div className={ "flex flex-col border-2 rounded-md" }>
			<Table>
				<TableBody>
					{ teams.map( team => (
						<TableRow key={ team.id }>
							<TableCell className={ "text-2xl md:text-4xl uppercase font-heading" }>
								{ team.name }
							</TableCell>
							<TableCell>
								<div className={ "flex gap-3 items-center" }>
									{ team.players.map( pid => players[ pid ] ).map( player => (
										<div key={ player.id } className={ "gap-2 items-center hidden sm:flex" }>
											<Avatar className={ "rounded-full w-7 h-7" }>
												<AvatarImage src={ player.avatar } alt={ "" }/>
											</Avatar>
											<h2 className={ "font-semibold" }>{ player.name.toUpperCase() }</h2>
										</div>
									) ) }
								</div>
							</TableCell>
							<TableCell className={ "text-center text-2xl md:text-4xl font-heading" }>
								{ team.score }
							</TableCell>
						</TableRow>
					) ) }
				</TableBody>
			</Table>
		</div>
	);
}