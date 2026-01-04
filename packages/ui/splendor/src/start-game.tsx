import { Button } from "@s2h-ui/primitives/button";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useStartGameMutation } from "@s2h/client/splendor";
import { useStore } from "@tanstack/react-store";
import { store } from "./store.tsx";

export function StartGame() {
	const gameId = useStore( store, state => state.id );
	const { mutateAsync, isPending } = useStartGameMutation( {} );

	const handleStartGame = () => mutateAsync( { gameId } );

	return (
		<Button className={ "flex-1 max-w-lg" } onClick={ handleStartGame }>
			{ isPending ? <Spinner/> : "START GAME" }
		</Button>
	);
}