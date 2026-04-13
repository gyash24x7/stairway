"use client";

import type { JoinMatchInput } from "@/shared/engine/types";
import { Button } from "@/shared/primitives/button";
import { Input } from "@/shared/primitives/input";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

type JoinGameProps = {
	game: string;
	joinMatch: ( opts: { data: JoinMatchInput } ) => Promise<string>;
};

export function JoinGame( { game, joinMatch }: JoinGameProps ) {
	const [ joinCode, setJoinCode ] = useState( "" );
	const [ error, setError ] = useState( "" );
	const navigate = useNavigate();
	const { isPending, mutate } = useMutation( {
		mutationFn: joinMatch,
		onSuccess: matchId => navigate( { to: `/${ game }/${ matchId }` } )
	} );

	const handleJoin = () => {
		const code = joinCode.trim().toUpperCase();
		if ( !code ) {
			return;
		}

		setError( "" );
		mutate( { data: { code } } );
	};

	return (
		<div className={ "rounded-md bg-background p-6 flex flex-col gap-4 flex-1" }>
			<h2 className={ "text-xl font-heading" }>Join Game</h2>
			<p className={ "text-sm text-muted-foreground" }>
				Enter a game code to join an existing match
			</p>
			<div className={ "flex gap-2" }>
				<Input
					value={ joinCode }
					onChange={ e => setJoinCode( e.target.value ) }
					placeholder={ "Game Code" }
					maxLength={ 6 }
					className={ "uppercase" }
					onKeyDown={ e => e.key === "Enter" && handleJoin() }
					disabled={ isPending }
				/>
				<Button onClick={ handleJoin } disabled={ !joinCode.trim() || isPending }>Join</Button>
			</div>
			{ error && <p className={ "text-sm text-red-500" }>{ error }</p> }
		</div>
	);
}
