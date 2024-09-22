import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input } from "@base/ui";
import { useState } from "react";
import { JoinGame } from "./game-actions.tsx";

export function JoinGameDialog() {
	const [ code, setCode ] = useState( "" );

	return (
		<Dialog>
			<DialogTrigger className={ "font-bold" }>
				JOIN GAME
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={ "text-xl" }>Join Game</DialogTitle>
				</DialogHeader>
				<div>
					<Input
						name={ "code" }
						placeholder={ "Enter Game Code" }
						value={ code }
						onChange={ ( e ) => setCode( e.target.value ) }
					/>
				</div>
				<DialogFooter>
					<JoinGame code={ code }/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}