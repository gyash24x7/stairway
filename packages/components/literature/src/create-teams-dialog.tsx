import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input
} from "@base/components";
import { useGameId, usePlayerCount, usePlayers } from "@literature/store";
import { chunk, shuffle } from "@stairway/cards";
import { useCallback, useState } from "react";
import { CreateTeams } from "./game-actions.tsx";
import { PlayerLobby } from "./player-lobby.tsx";

export const CreateTeamsDialog = () => {
	const gameId = useGameId();
	const players = usePlayers();
	const playerCount = usePlayerCount();

	const [ teamAName, setTeamAName ] = useState( "" );
	const [ teamBName, setTeamBName ] = useState( "" );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );

	const [ open, setOpen ] = useState( false );

	const groupPlayers = useCallback( () => {
		const teamMembers = chunk( shuffle( Object.keys( players ) ), playerCount / 2 );
		setTeamMemberData( {
			[ teamAName ]: teamMembers[ 0 ],
			[ teamBName ]: teamMembers[ 1 ]
		} );
	}, [ teamAName, teamBName, players, playerCount ] );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger asChild>
				<Button className={ "flex-1 max-w-lg" }>CREATE TEAMS</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>Create Teams</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<Input
						type="text"
						placeholder="Enter Team Name"
						value={ teamAName }
						onChange={ ( e ) => setTeamAName( e.target.value ) }
					/>
					<Input
						type="text"
						placeholder="Enter Team Name"
						value={ teamBName }
						onChange={ ( e ) => setTeamBName( e.target.value ) }
					/>
					<Button
						className={ "w-full" }
						onClick={ groupPlayers }
						disabled={ !teamAName || !teamBName || teamAName === teamBName }
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
					<CreateTeams
						gameId={ gameId }
						data={ teamMemberData }
						onSubmit={ () => setOpen( false ) }
						playerCount={ playerCount }
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};