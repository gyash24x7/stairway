import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { ChangeEvent, Fragment, useState } from "react";
import { useCurrentGame } from "../utils";
import { PlayerCard } from "./player-card";
import { useCreateTeamsMutation } from "@literature/client";
import { modals } from "@mantine/modals";
import { chunk, shuffle } from "@s2h/cards";
import { useDisclosure } from "@mantine/hooks";


export function CreateTeams() {
	const { id, players, playerCount } = useCurrentGame();
	const [ teamNames, setTeamNames ] = useState<string[]>( [] );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );
	const [ opened, { open, close } ] = useDisclosure();

	const handleInput = ( index: 0 | 1 ) => ( e: ChangeEvent<HTMLInputElement> ) => {
		setTeamNames( teamNames => {
			teamNames[ index ] = e.currentTarget.value;
			return teamNames;
		} );
	};

	const groupPlayers = () => {
		const teamMembers = chunk( shuffle( Object.keys( players ) ), playerCount / 2 );
		setTeamMemberData( {
			[ teamNames[ 0 ] ]: teamMembers[ 0 ],
			[ teamNames[ 1 ] ]: teamMembers[ 1 ]
		} );
	};

	const { mutateAsync, isLoading } = useCreateTeamsMutation( id, {
		onSuccess: () => {
			modals.closeAll();
		},
		onError( error: Error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const createTeams = () => mutateAsync( { data: teamMemberData } );

	return (
		<Fragment>
			<Modal opened={ opened } onClose={ close } centered size={ "lg" } title={ "Create Teams" }>
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
					<Button onClick={ groupPlayers }>Group Players</Button>

					{ teamNames.map( team => (
						<Stack key={ team }>
							<Text>Team { team }</Text>
							<Group>
								{ teamMemberData[ team ].map( member => (
									<PlayerCard player={ players[ member ] }/>
								) ) }
							</Group>
						</Stack>
					) ) }

					<Button onClick={ createTeams } loading={ isLoading }>
						Create Teams
					</Button>
				</Stack>
			</Modal>
			<Button fullWidth color={ "primary" } onClick={ open }>Create Teams</Button>
		</Fragment>
	);
}