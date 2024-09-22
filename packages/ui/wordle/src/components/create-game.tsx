import { Button, Spinner } from "@base/ui";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { wordle } from "../client.ts";

export function CreateGame() {
	const navigate = useNavigate();
	const { mutate, isPending } = useMutation( {
		mutationFn: wordle.createGame.mutate,
		onSuccess: ( data ) => navigate( { to: "/wordle/$gameId", params: { gameId: data.id } } )
	} );

	return (
		<Button onClick={ () => mutate( { wordCount: 4 } ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}
