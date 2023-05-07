import { Button, Flex } from "@s2h/ui";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../utils/game-context";
import { trpc } from "../utils/trpc";

export const StartGame = function () {
	const { id: gameId } = useGame();
	const navigate = useNavigate();

	const { mutateAsync, isLoading } = trpc.startGame.useMutation( {
		async onSuccess( { id } ) {
			navigate( `/play/${ id }` );
		},
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const startGame = () => mutateAsync( { gameId } );

	return (
		<Flex justify={ "center" } className={ "mt-4" }>
			<Button
				fullWidth
				buttonText={ "Start Game" }
				appearance={ "primary" }
				isLoading={ isLoading }
				onClick={ startGame }
			/>
		</Flex>
	);
};