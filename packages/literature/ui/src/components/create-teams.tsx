import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { chunk, shuffle } from "@s2h/cards";
import { ChangeEvent, Fragment, useCallback, useState } from "react";
import { useCreateTeamsAction, useGameData } from "../utils";
import { DisplayPlayerMedium } from "./display-player";


export function CreateTeams() {
	const { id: gameId, players, playerCount } = useGameData()!;

	const [ teamAName, setTeamAName ] = useState<string>( "" );
	const [ teamBName, setTeamBName ] = useState<string>( "" );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );
	const [ opened, { open, close } ] = useDisclosure();

	const handleTeamAInput = useCallback( ( e: ChangeEvent<HTMLInputElement> ) => {
		setTeamAName( e.target.value );
	}, [] );

	const handleTeamBInput = useCallback( ( e: ChangeEvent<HTMLInputElement> ) => {
		setTeamBName( e.target.value );
	}, [] );

	const groupPlayers = useCallback( () => {
		const teamMembers = chunk( shuffle( Object.keys( players ) ), playerCount / 2 );
		setTeamMemberData( {
			[ teamAName ]: teamMembers[ 0 ],
			[ teamBName ]: teamMembers[ 1 ]
		} );
	}, [ teamAName, teamBName, players, playerCount ] );

	const { execute, isLoading } = useCreateTeamsAction();

	const handleSubmit = useCallback(
		() => execute( { data: teamMemberData, gameId } ),
		[ teamMemberData, gameId ]
	);

	return (
		<Fragment>
			<Modal opened={ opened } onClose={ close } centered size={ "lg" } title={ "Create Teams" }>
				<Stack>
					<TextInput
						name={ "team1" }
						value={ teamAName }
						onInput={ handleTeamAInput }
						placeholder={ "Enter Team Name" }
					/>
					<TextInput
						name={ "team2" }
						value={ teamBName }
						onInput={ handleTeamBInput }
						placeholder={ "Enter Team Name" }
					/>
					<Button onClick={ groupPlayers } fw={ 700 }>GROUP PLAYERS</Button>

					{ Object.keys( teamMemberData ).map( team => (
						<Stack key={ team }>
							<Text>Team { team }</Text>
							<Group>
								{ teamMemberData[ team ]?.map( member => (
									<DisplayPlayerMedium player={ players[ member ] } key={ member }/>
								) ) }
							</Group>
						</Stack>
					) ) }

					<Button onClick={ handleSubmit } loading={ isLoading } fw={ 700 }>
						CREATE TEAMS
					</Button>
				</Stack>
			</Modal>
			<Button color={ "brand" } onClick={ open } fw={ 700 }>CREATE TEAMS</Button>
		</Fragment>
	);
}