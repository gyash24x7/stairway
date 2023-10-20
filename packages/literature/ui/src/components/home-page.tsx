import { Box, Button, Group, Paper, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { homePageClassnames as classnames } from "../styles";
import { useCreateGameMutation } from "@literature/client";
import { Navbar } from "@auth/ui";
import { JoinGame } from "./join-game";

export function HomePage() {
	const navigate = useNavigate();

	const { isPending, mutateAsync } = useCreateGameMutation( {
		onSuccess: ( { id } ) => {
			navigate( "/literature/" + id );
		},
		onError( error: any ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const createGame = () => mutateAsync( { playerCount: 2 } );

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
						<Button color={ "primary" } onClick={ createGame } loading={ isPending }>
							Create Game
						</Button>
						<JoinGame/>
					</Group>
				</Paper>
			</Box>
		</Box>
	);
}