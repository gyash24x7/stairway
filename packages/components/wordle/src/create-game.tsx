import { Button, Spinner } from "@base/components";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { client } from "@wordle/store";

export function CreateGame() {
	const navigate = useNavigate();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.createGame.mutate,
		onSuccess: ( data ) => navigate( { to: "/wordle/$gameId", params: { gameId: data.id } } )
	} );

	return (
		<Button onClick={ () => mutate( { wordCount: 4 } ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}
