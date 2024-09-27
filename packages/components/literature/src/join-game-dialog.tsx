import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input
} from "@base/components";
import { useState } from "react";
import { JoinGame } from "./game-actions.tsx";

export function JoinGameDialog() {
	const [ code, setCode ] = useState( "" );

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant={ "secondary" }>JOIN GAME</Button>
			</DialogTrigger>
			<DialogContent>
				<div className={ "mx-auto w-full max-w-sm" }>
					<DialogHeader>
						<DialogTitle className={ "text-xl text-center" }>Join Game</DialogTitle>
					</DialogHeader>
					<div className={ "px-4" }>
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
				</div>
			</DialogContent>
		</Dialog>
	);
}