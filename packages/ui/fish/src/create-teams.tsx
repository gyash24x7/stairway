import { Button, buttonVariants } from "@s2h-ui/primitives/button";
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
import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { useCreateTeamsMutation } from "@s2h/client/fish";
import { chunk, shuffle } from "@s2h/utils/array";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { PlayerLobby } from "./player-lobby.tsx";
import { store } from "./store.tsx";

export function CreateTeams() {
	const gameId = useStore( store, state => state.id );
	const playerIds = useStore( store, state => state.playerIds );
	const playerCount = useStore( store, state => state.config.playerCount );
	const teamCount = useStore( store, state => state.config.teamCount );

	const [ teamNames, setTeamNames ] = useState<string[]>( [] );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );
	const [ open, setOpen ] = useState( false );

	const { mutateAsync, isPending } = useCreateTeamsMutation( {
		onSuccess: () => setOpen( false )
	} );

	const groupPlayers = () => {
		const teamMembers = chunk( shuffle( playerIds ), playerCount / teamCount );
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
			<DialogTrigger className={ cn( buttonVariants(), "flex-1 max-w-lg" ) }>CREATE TEAMS</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>CREATE TEAMS</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ cn( "grid grid-cols-1 gap-2", teamCount === 4 && "grid-cols-2" ) }>
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
				</div>
				<Button
					className={ "w-full" }
					onClick={ groupPlayers }
					disabled={ teamNames.length !== teamCount }
				>
					GROUP PLAYERS
				</Button>
				{ Object.keys( teamMemberData ).length ===
					teamCount &&
                    <PlayerLobby asTeams={ teamMemberData } withBg withTeamName/> }
				<DialogFooter>
					<Button onClick={ handleCreateTeams } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "CREATE TEAMS" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}