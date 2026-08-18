import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/shared/ui/primitives/button.tsx";
import { Input } from "@/shared/ui/primitives/input.tsx";
import { errorMessage } from "@/shared/ui/utils/errors.ts";
import { GameCode, JoinGameInput } from "@/swish/shared/schema.ts";

import type { GameRef } from "@/swish/shared/schema.ts";

type JoinGameProps = {
	game: string;
	joinGame: ( input: JoinGameInput ) => Promise<GameRef>;
};

export function JoinGame( { game, joinGame: joinGameFn }: JoinGameProps ) {
	const navigate = useNavigate();
	const [ joinCode, setJoinCode ] = useState( "" );
	const [ error, setError ] = useState( "" );

	const joinGame = useMutation( {
		mutationFn: ( code: GameCode ) => joinGameFn( JoinGameInput.make( { code } ) ),
		onSuccess: ( { id } ) => navigate( { to: `/${ game }/${ id }` } ),
		onError: e => setError( errorMessage( e ) )
	} );

	const handleJoin = () => {
		const code = joinCode.trim().toUpperCase();
		if ( !code ) {
			return;
		}

		setError( "" );
		joinGame.mutate( GameCode.make( code ) );
	};

	return (
		<div className={ "rounded-md bg-background p-6 flex flex-col gap-4 flex-1" }>
			<h2 className={ "text-xl font-heading" }>Join Game</h2>
			<p className={ "text-sm text-muted-foreground" }>
				Enter a game code to join an existing game
			</p>
			<div className={ "flex gap-2" }>
				<Input
					value={ joinCode }
					onChange={ e => setJoinCode( e.target.value ) }
					placeholder={ "Game Code" }
					maxLength={ 6 }
					className={ "uppercase" }
					onKeyDown={ e => e.key === "Enter" && handleJoin() }
					disabled={ joinGame.isPending }
				/>
				<Button
					onClick={ handleJoin }
					disabled={ !joinCode.trim() || joinGame.isPending }
				>
					Join
				</Button>
			</div>
			{ error && <p className={ "text-sm text-destructive" }>{ error }</p> }
		</div>
	);
}
