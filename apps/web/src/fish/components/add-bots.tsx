"use client";

import { orpc } from "@s2h/client/query";
import { useFish } from "@/fish/components/context";
import { Button } from "@s2h/ui/primitives/button";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function AddBots() {
	const { shared } = useFish();
	const queryClient = useQueryClient();

	const addBots = useMutation( orpc.fish.addBots.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.fish.getGame.key( { input: { gameId: shared.id } } )
		} )
	} ) );

	const handleClick = () => addBots.mutate( { gameId: shared.id } );

	return (
		<Button onClick={ handleClick } disabled={ addBots.isPending }>
			{ addBots.isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}
