import { Button, Flex, Modal, MultiSelect, TextInput, VStack } from "@s2h/ui";
import { Fragment, useState } from "react";
import { trpc, useGame } from "../utils";
import { PlayerCard } from "./player-card";

export function CreateTeams() {
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ team1, setTeam1 ] = useState( "" );
	const [ team2, setTeam2 ] = useState( "" );
	const [ team1Members, setTeam1Members ] = useState<string[]>( [] );
	const [ team2Members, setTeam2Members ] = useState<string[]>( [] );
	const { id, players, playerList } = useGame();

	const { mutateAsync, isLoading } = trpc.createTeams.useMutation( {
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const createTeams = () => mutateAsync( {
		teams: [
			{ name: team1, members: team1Members },
			{ name: team2, members: team2Members }
		], gameId: id
	} );

	const openModal = () => setIsModalOpen( true );

	return (
		<Fragment>
			<Modal
				isOpen={ isModalOpen }
				onClose={ () => setIsModalOpen( false ) }
				title={ "Create Teams" }
			>
				<VStack>
					<TextInput
						label={ "Team 1 Name" }
						name={ "team1" }
						value={ team1 }
						onChange={ setTeam1 }
						placeholder={ "Enter Name for Team 1" }
					/>
					<MultiSelect<string>
						label={ "Team 1 Members" }
						values={ team1Members.map( memberId => {
							return { label: players[ memberId ].name, value: memberId };
						} ) }
						onChange={ ( options ) => setTeam1Members( options.map( ( { value } ) => value ) ) }
						options={ playerList.map( player => {
							return { label: player.name, value: player.id };
						} ) }
						renderOption={ ( { value } ) => <PlayerCard player={ players[ value ] }/> }
					/>
					<TextInput
						label={ "Team 2 Name" }
						name={ "team2" }
						value={ team2 }
						onChange={ setTeam2 }
						placeholder={ "Enter Name for Team 2" }
					/>
					<MultiSelect<string>
						label={ "Team 2 Members" }
						values={ team2Members.map( memberId => {
							return { label: players[ memberId ].name, value: memberId };
						} ) }
						onChange={ ( options ) => setTeam2Members( options.map( ( { value } ) => value ) ) }
						options={ playerList.map( player => {
							return { label: player.name, value: player.id };
						} ) }
						renderOption={ ( { value } ) => <PlayerCard player={ players[ value ] }/> }
					/>
					<div className={ "mt-6" }>
						<Button
							size={ "sm" }
							buttonText={ "Submit" }
							appearance={ "primary" }
							isLoading={ isLoading }
							onClick={ createTeams }
						/>
					</div>
				</VStack>
			</Modal>
			<Flex justify={ "center" } className={ "mt-4" }>
				<Button
					fullWidth
					buttonText={ "Create Teams" }
					appearance={ "primary" }
					onClick={ openModal }
				/>
			</Flex>
		</Fragment>
	);
}