"use client";

import { useFish } from "@/fish/components/context";
import { addBots } from "@/fish/core/actions";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

export function AddBots() {
	const { match } = useFish();
	const addBotsFn = useServerFn( addBots );
	const { isPending, mutate } = useMutation( { mutationFn: addBotsFn } );

	const handleClick = () => mutate( { data: { matchId: match.id } } );

	return (
		<Button onClick={ handleClick } disabled={ isPending } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}
