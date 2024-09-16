"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Spinner
} from "@base/ui";
import { chunk, shuffle } from "@stairway/cards";
import { useCallback, useState } from "react";
import { useServerAction } from "zsa-react";
import { createTeamsAction } from "../actions";
import { useGameId, usePlayerCount, usePlayers } from "../store";
import { DisplayPlayer } from "./display-player";

export const CreateTeams = () => {
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

	const { isPending, execute } = useServerAction( createTeamsAction, {
		onFinish: () => setOpen( false )
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger asChild>
				<Button>CREATE TEAMS</Button>
			</DialogTrigger>
			<DialogContent>
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
					<Button className={ "w-full" } onClick={ groupPlayers }>GROUP PLAYERS</Button>
					<div className={ "flex flex-col gap-5" }>
						{ Object.keys( teamMemberData ).map( ( team ) => (
							<div key={ team } className={ "flex flex-col gap-5" }>
								<h3>Team { team }</h3>
								<div className={ "flex flex-wrap gap-3" }>
									{ teamMemberData[ team ]?.map( member => (
										<DisplayPlayer player={ players[ member ] } key={ players[ member ].id }/>
									) ) }
								</div>
							</div>
						) ) }
					</div>
				</div>
				<DialogFooter>
					<Button className={ "w-full" } onClick={ () => execute( { gameId, data: teamMemberData } ) }>
						{ isPending ? <Spinner/> : "CREATE TEAMS" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};