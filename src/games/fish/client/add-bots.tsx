"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { addBotsFn } from "@/games/fish/client/client.ts";
import { useFish } from "@/games/fish/client/context.tsx";

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
