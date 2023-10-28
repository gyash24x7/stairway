import { Navbar } from "@auth/ui";
import { Box, Button, Group, Paper, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { homePageClassnames as classnames } from "../styles";
import { useCreateGameAction } from "../utils";
import { JoinGame } from "./join-game";
import { useCallback } from "react";

export function HomePage() {
	const navigate = useNavigate();
	const { isLoading, execute } = useCreateGameAction();

	const handleSubmit = useCallback(
		() => execute( { playerCount: 2 } )
			.then( ( { id } ) => navigate( "/literature/" + id ) )
			.catch( ( error: Error ) => alert( error.message ) ),
		[]
	);

	return (
		<Box p={ "xl" }>
			<Navbar/>
			<Box py={ "xl" }>
				<Paper shadow={ "md" } p={ "xl" } radius={ "md" } className={ classnames.card }>
					<div>
						<Text className={ classnames.category } size={ "xs" }>Games</Text>
						<Title order={ 3 } className={ classnames.title }>Literature</Title>
					</div>
					<Group>
						<Button color={ "primary" } onClick={ handleSubmit } loading={ isLoading }>
							Create Game
						</Button>
						<JoinGame/>
					</Group>
				</Paper>
			</Box>
		</Box>
	);
}