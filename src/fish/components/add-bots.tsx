"use client";

import { useFish } from "@/fish/components/context";
import { addBots } from "@/fish/core/actions";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { useTransition } from "react";

export function AddBots() {
	const { game } = useFish();
	const [ isPending, startTransition ] = useTransition();

	const handleClick = () => startTransition( async () => {
		await addBots( { gameId: game.id } );
	} );

	return (
		<Button onClick={ handleClick } disabled={ isPending } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}
