"use client";

import { Button } from "@s2h/ui/primitives/button";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addBotsFn } from "./client";
import { useFish } from "./context";

export function AddBots() {
	const { shared } = useFish();
	const queryClient = useQueryClient();

	const addBots = useMutation( {
		mutationFn: () => addBotsFn( shared.id ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "fish", "getState", shared.id ]
		} )
	} );

	const handleClick = () => addBots.mutate();

	return (
		<Button onClick={ handleClick } disabled={ addBots.isPending }>
			{ addBots.isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}
