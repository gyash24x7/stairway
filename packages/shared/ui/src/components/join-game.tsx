import { GameCode } from "@s2h/swish/schema";
import { useNavigate } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { Button } from "../primitives/button.tsx";
import { Input } from "../primitives/input.tsx";

type JoinGameProps = {
	game: string;
	joinGame: ( input: { code: GameCode } ) => Promise<string>;
};

export function JoinGame( { game, joinGame }: JoinGameProps ) {
	const navigate = useNavigate();
	const [ joinCode, setJoinCode ] = useState( "" );
	const [ error, setError ] = useState( "" );
	const [ isPending, startTransition ] = useTransition();

	const handleJoin = () => startTransition( async () => {
		const code = joinCode.trim().toUpperCase();
		if ( !code ) {
			return;
		}

		setError( "" );

		const gameId = await joinGame( { code: GameCode.make( code ) } );
		await navigate( { to: `/${ game }/${ gameId }` } );
	} );

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
					disabled={ isPending }
				/>
				<Button onClick={ handleJoin } disabled={ !joinCode.trim() || isPending }>
					Join
				</Button>
			</div>
			{ error && <p className={ "text-sm text-red-500" }>{ error }</p> }
		</div>
	);
}
