"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Spinner
} from "@base/ui";
import { EnterIcon } from "@radix-ui/react-icons";
import { redirect } from "next/navigation";
import { Fragment, useState } from "react";
import { useServerAction } from "zsa-react";
import { joinGameAction } from "../actions";

export function JoinGame() {
	const [ code, setCode ] = useState( "" );
	const { isPending, execute } = useServerAction( joinGameAction, {
		onSuccess( { data } ) {
			redirect( `/literature/${ data }` );
		}
	} );

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
					<Input name={ "code" } placeholder={ "Enter Game Code" } value={ code }
						   onChange={ ( e ) => setCode( e.target.value ) }/>
				</div>
				<DialogFooter>
					<Button onClick={ () => execute( { code } ) }>
						{ isPending
							? <Spinner/>
							: (
								<Fragment>
									<EnterIcon className={ "mr-2" }/>
									<Fragment>JOIN GAME</Fragment>
								</Fragment>
							)
						}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}