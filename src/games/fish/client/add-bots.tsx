"use client";

import { Button } from "@/shared/ui/primitives/button";
import { Spinner } from "@/shared/ui/primitives/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addBotsFn } from "./client";
import { useFish } from "./context";

export function AddBots() {
	const { data } = useFish();
	const queryClient = useQueryClient();

	const addBots = useMutation( {
		mutationFn: () => addBotsFn( data.id ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "fish", "getState", data.id ]
		} )
	} );

	const handleClick = () => addBots.mutate();

	return (
		<Button onClick={ handleClick } disabled={ addBots.isPending }>
			{ addBots.isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}
