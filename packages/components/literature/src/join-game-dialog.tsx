import {
	Button,
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
	Input
} from "@base/components";
import { useState } from "react";
import { JoinGame } from "./game-actions.tsx";

export function JoinGameDialog() {
	const [ code, setCode ] = useState( "" );

	return (
		<Drawer>
			<DrawerTrigger asChild>
				<Button variant={ "secondary" }>JOIN GAME</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-sm" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-xl text-center" }>Join Game</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-4" }>
						<Input
							name={ "code" }
							placeholder={ "Enter Game Code" }
							value={ code }
							onChange={ ( e ) => setCode( e.target.value ) }
						/>
					</div>
					<DrawerFooter>
						<JoinGame code={ code }/>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}