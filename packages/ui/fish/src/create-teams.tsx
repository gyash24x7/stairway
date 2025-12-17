import { Button } from "@s2h-ui/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@s2h-ui/primitives/dialog";
import { Input } from "@s2h-ui/primitives/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from "@s2h-ui/primitives/select";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useCreateTeamsMutation } from "@s2h/client/fish";
import type { TeamCount } from "@s2h/fish/types";
import { chunk, shuffle } from "@s2h/utils/array";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { PlayerLobby } from "./player-lobby.tsx";
import { store } from "./store.tsx";

export function CreateTeams() {
	const gameId = useStore( store, state => state.id );
	const players = useStore( store, state => state.players );
	const playerCount = useStore( store, state => state.config.playerCount );

	const [ teamCount, setTeamCount ] = useState<TeamCount>( 2 );
	const [ teamNames, setTeamNames ] = useState<string[]>( [] );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );
	const [ open, setOpen ] = useState( false );

	const { mutateAsync, isPending } = useCreateTeamsMutation( {
		onSuccess: () => setOpen( false )
	} );

	const groupPlayers = () => {
		const teamMembers = chunk( shuffle( Object.keys( players ) ), playerCount / teamCount );
		setTeamMemberData( teamNames.reduce(
			( acc, name, idx ) => {
				acc[ name ] = teamMembers[ idx ] || [];
				return acc;
			},
			{} as Record<string, string[]>
		) );
	};

	const handleCreateTeams = () => mutateAsync( { gameId, teams: teamMemberData } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger>
				<Button className={ "flex-1 max-w-lg" }>CREATE TEAMS</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>CREATE TEAMS</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<Select
						value={ teamCount }
						onValueChange={ ( value ) => setTeamCount( value ?? 2 ) }
					>
						<SelectTrigger className={ "w-full" }>
							<SelectValue/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="2">2 TEAMS</SelectItem>
							<SelectSeparator/>
							<SelectItem value="3">3 TEAMS</SelectItem>
							<SelectSeparator/>
							<SelectItem value="4">4 TEAMS</SelectItem>
							<SelectSeparator/>
							<SelectItem value="5">5 TEAMS</SelectItem>
							<SelectSeparator/>
							<SelectItem value="6">6 TEAMS</SelectItem>
						</SelectContent>
					</Select>
					{ Array( teamCount ).fill( null ).map( ( _, idx ) => (
						<Input
							key={ idx }
							type="text"
							placeholder={ `Enter Team ${ idx + 1 } Name` }
							value={ teamNames[ idx ] || "" }
							onChange={ ( e ) => {
								const newNames = [ ...teamNames ];
								newNames[ idx ] = e.target.value;
								setTeamNames( newNames );
							} }
						/>
					) ) }
					<Button
						className={ "w-full" }
						onClick={ groupPlayers }
						disabled={ teamNames.length !== teamCount }
					>
						GROUP PLAYERS
					</Button>
					<div className={ "flex flex-col gap-3" }>
						{ Object.keys( teamMemberData ).map( ( team ) => (
							<div key={ team } className={ "flex flex-col gap-2" }>
								<h3 className={ "font-semibold" }>Team { team }</h3>
								<PlayerLobby withBg playerIds={ teamMemberData[ team ] }/>
							</div>
						) ) }
					</div>
				</div>
				<DialogFooter>
					<Button onClick={ handleCreateTeams } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "CREATE TEAMS" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}