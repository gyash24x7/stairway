import { Button, Flex, Image, Stack } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { homePageClassnames as classnames } from "../styles";
import { useCreateGameMutation } from "@literature/client";
import { modals } from "@mantine/modals";
import { JoinGame } from "./join-game";

export function HomePage() {
	const navigate = useNavigate();

	const createGameMutation = useCreateGameMutation( {
		onSuccess: ( id ) => {
			navigate( "/literature/" + id );
		},
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const createGame = () => createGameMutation.mutateAsync( { playerCount: 2 } );

	const openJoinGameModal = () => modals.open( { title: "Join Game", children: <JoinGame/>, centered: true } );

	return (
		<Flex justify={ "center" } align={ "center" } className={ classnames.flex }>
			<Stack gap={ "xxl" } className={ classnames.stack }>
				<Image src={ "logo.png" } height={ 200 } fit={ "contain" }/>
				<Button color={ "primary" } fullWidth onClick={ createGame } loading={ createGameMutation.isLoading }>
					Create Game
				</Button>
				<Button color={ "info" } fullWidth onClick={ openJoinGameModal }>Join Game</Button>
			</Stack>
		</Flex>
	);
}