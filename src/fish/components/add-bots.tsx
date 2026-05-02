"use client";

import { useFish } from "@/fish/components/context";
import { addBots } from "@/fish/core/actions";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { useTransition } from "react";

export function AddBots() {
	const { shared } = useFish();
	const [ isPending, startTransition ] = useTransition();

	const handleClick = () => startTransition( async () => {
		await addBots( { gameId: shared.id } );
	} );

	return (
		<Button onClick={ handleClick } disabled={ isPending }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}
