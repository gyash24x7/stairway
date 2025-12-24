import { Button, buttonVariants } from "@s2h-ui/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@s2h-ui/primitives/dialog";
import { Input } from "@s2h-ui/primitives/input";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useJoinGameMutation } from "@s2h/client/callbreak";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function JoinGame() {
	const [ code, setCode ] = useState( "" );
	const navigate = useNavigate();
	const { mutateAsync, isPending } = useJoinGameMutation( {
		onSuccess: ( { gameId } ) => navigate( { to: `/callbreak/${ gameId }` } ),
		onError: ( err ) => alert( err.message ),
		onSettled: () => setCode( "" )
	} );

	const handleClick = () => mutateAsync( { code } );

	return (
		<Dialog>
			<DialogTrigger className={ buttonVariants() }>JOIN GAME</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={ "text-xl text-center" }>Join Game</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<Input
					name={ "code" }
					placeholder={ "Enter Game Code" }
					value={ code }
					onChange={ ( e ) => setCode( e.target.value ) }
				/>
				<DialogFooter>
					<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "JOIN GAME" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}