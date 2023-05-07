import { Button, Flex, Modal, TextInput } from "@s2h/ui";
import React, { Fragment, useState } from "react";
import { useGame } from "../utils/game-context";
import { trpc } from "../utils/trpc";

export function CreateTeams() {
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ team1, setTeam1 ] = useState( "" );
	const [ team2, setTeam2 ] = useState( "" );
	const { id } = useGame();

	const { mutateAsync, isLoading } = trpc.createTeams.useMutation( {
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const createTeams = () => mutateAsync( { teams: [ team1, team2 ], gameId: id } );

	const openModal = () => setIsModalOpen( true );

	return (
		<Fragment>
			<Modal
				isOpen={ isModalOpen }
				onClose={ () => setIsModalOpen( false ) }
				title={ "Create Teams" }
			>
				<Flex direction={ "col" } className={ "space-y-2" }>
					<TextInput
						name={ "team1" }
						value={ team1 }
						onChange={ setTeam1 }
						placeholder={ "Enter Name for Team 1" }
					/>
					<TextInput
						name={ "alias" }
						value={ team2 }
						onChange={ setTeam2 }
						placeholder={ "Enter Name for Team 2" }
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
				</Flex>
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