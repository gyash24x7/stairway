import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { ChangeEvent, useState } from "react";
import { useCurrentGame } from "../utils";
import { PlayerCard } from "./player-card";
import { useCreateTeamsMutation } from "@literature/client";
import { modals } from "@mantine/modals";
import { chunk, shuffle } from "@s2h/cards";

function CreateTeamsModalContent() {
	const [ teamNames, setTeamNames ] = useState<string[]>( [] );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );
	const { id, players, playerIds, playerCount } = useCurrentGame();

	const handleInput = ( index: 0 | 1 ) => ( e: ChangeEvent<HTMLInputElement> ) => {
		setTeamNames( teamNames => {
			teamNames[ index ] = e.currentTarget.value;
			return teamNames;
		} );
	};

	const validateTeamNames = () => {
		return teamNames.length === 2 && !!teamNames[ 0 ] && !!teamNames[ 1 ];
	};

	const validateTeamMembers = () => {
		return validateTeamNames()
			&& Object.keys( teamMemberData ).length === 2
			&& teamMemberData[ teamNames[ 0 ] ].length !== 0
			&& teamMemberData[ teamNames[ 1 ] ].length !== 0;
	};

	const groupPlayers = () => {
		const teamMembers = chunk( shuffle( playerIds ), playerCount / 2 );
		setTeamMemberData( {
			[ teamNames[ 0 ] ]: teamMembers[ 0 ],
			[ teamNames[ 1 ] ]: teamMembers[ 1 ]
		} );
	};

	const { mutateAsync, isLoading } = useCreateTeamsMutation( id, {
		onError( error: Error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const createTeams = () => mutateAsync( { data: teamMemberData } );

	return (
		<Stack>
			<TextInput
				name={ "team1" }
				value={ teamNames[ 0 ] }
				onChange={ handleInput( 0 ) }
				placeholder={ "Enter Team Name" }
			/>
			<TextInput
				name={ "team2" }
				value={ teamNames[ 1 ] }
				onChange={ handleInput( 1 ) }
				placeholder={ "Enter Team Name" }
			/>
			<Button onClick={ groupPlayers } disabled={ !validateTeamNames() }>Group Players</Button>

			{ validateTeamMembers() && teamNames.map( team => (
				<Stack>
					<Text>Team { team }</Text>
					<Group>
						{ teamMemberData[ team ].map( member => (
							<PlayerCard player={ players[ member ] }/>
						) ) }
					</Group>
				</Stack>
			) ) }

			<Button onClick={ createTeams } loading={ isLoading } disabled={ !validateTeamMembers() }>
				Create Teams
			</Button>
		</Stack>
	);
}

export function CreateTeams() {
	const openCreateTeamsModal = () => modals.open( {
		title: "CreateTeams",
		centered: true,
		children: <CreateTeamsModalContent/>
	} );

	return <Button fullWidth color={ "primary" } onClick={ openCreateTeamsModal }>Create Teams</Button>;
}