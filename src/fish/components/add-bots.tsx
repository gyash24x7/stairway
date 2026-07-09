"use client";

import { orpc } from "@/api/query";
import { useFish } from "@/fish/components/context";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
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
