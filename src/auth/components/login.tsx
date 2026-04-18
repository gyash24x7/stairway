"use client";

import {
	checkIfUserExists,
	getLoginOptions,
	getRegisterOptions,
	verifyLogin,
	verifyRegistration
} from "@/auth/core/actions";
import { Button } from "@/shared/primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/primitives/dialog";
import { Input } from "@/shared/primitives/input";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { LogInIcon } from "lucide-react";
import { Fragment, useState, useTransition } from "react";

export function Login() {
	const [ isPending, startTransition ] = useTransition();
	const [ mode, setMode ] = useState<"login" | "register">( "login" );
	const [ open, setOpen ] = useState( false );
	const [ username, setUsername ] = useState( "" );
	const [ name, setName ] = useState( "" );

	const passkeyLogin = async () => {
		const exists = await checkIfUserExists( { username } );
		if ( !exists ) {
			setMode( "register" );
			return;
		}

		const optionsJSON = await getLoginOptions( { username } );
		const response = await startAuthentication( { optionsJSON } );
		await verifyLogin( { username, response } );
		window.location.href = "/";
	};

	const passkeyRegister = async () => {
		const optionsJSON = await getRegisterOptions( { username, name } );
		const response = await startRegistration( { optionsJSON } );
		await verifyRegistration( { username, name, response } );
		window.location.href = "/";
	};

	const isValidInput = () => mode === "register"
		? !!username.trim() && !!name.trim()
		: !!username.trim();

	const performPasskeyLogin = () => startTransition( async () => {
		if ( !isValidInput() ) {
			alert( "Please fill in all required fields." );
			return;
		}

		if ( mode === "register" ) {
			await passkeyRegister();
		} else {
			await passkeyLogin();
		}
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<Button onClick={ () => setOpen( true ) }>LOGIN</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={ cn( "text-2xl" ) }>
						{ mode === "register" ? "REGISTER" : "LOGIN" }
					</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<label>Username</label>
					<Input
						type={ "text" }
						value={ username }
						onChange={ ( e ) => setUsername( e.target.value ) }
						placeholder={ "Enter your username" }
					/>
					{ mode === "register" && (
						<Fragment>
							<label>Name</label>
							<Input
								type={ "text" }
								value={ name }
								onChange={ ( e ) => setName( e.target.value ) }
								placeholder={ "Enter your name" }
							/>
						</Fragment>
					) }
				</div>
				<DialogFooter>
					<Button
						className={ "flex gap-2 items-center" }
						onClick={ performPasskeyLogin }
						disabled={ isPending || !isValidInput() }
					>
						{ isPending ? <Spinner/> : (
							<Fragment>
								<Fragment>{ mode === "register" ? "REGISTER" : "LOGIN" }</Fragment>
								<LogInIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
							</Fragment>
						) }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}