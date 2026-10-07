import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { cn } from "cn";
import { LogInIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { useNavigate } from "react-router";

import type { User } from "@/auth/schema";
import { RegisterInput } from "@/auth/schema";
import { loginWithPasskeyAtom, PasskeyDismissed, registerWithPasskeyAtom } from "@/auth/ui/client";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/shared/primitives/dialog";
import { Input } from "@/shared/primitives/input";
import { Spinner } from "@/shared/primitives/spinner";


export function Login() {
	const navigate = useNavigate();

	const login = useAtomSet( loginWithPasskeyAtom, { mode: "promiseExit" } );
	const register = useAtomSet( registerWithPasskeyAtom, { mode: "promiseExit" } );

	const loginResult = useAtomValue( loginWithPasskeyAtom );
	const registerResult = useAtomValue( registerWithPasskeyAtom );
	const isPending = loginResult.waiting || registerResult.waiting;

	const [ mode, setMode ] = useState<"login" | "register">( "login" );
	const [ open, setOpen ] = useState( false );
	const [ username, setUsername ] = useState( "" );
	const [ name, setName ] = useState( "" );
	const [ error, setError ] = useState<string | null>( null );

	const supportsPasskeys = browserSupportsWebAuthn();

	const isValidInput = () => mode === "register"
		? Schema.is( RegisterInput )( { name: name.trim(), username: username.trim() } )
		: true;

	const finish = async <E, >( exit: Exit.Exit<User, E> ) => {
		if ( Exit.isSuccess( exit ) ) {
			setOpen( false );
			await navigate( "/" );
			return;
		}

		const failure = Cause.findErrorOption( exit.cause );

		// A dismissed prompt is the user changing their mind, not a failure.
		if ( Option.isSome( failure ) && failure.value instanceof PasskeyDismissed ) {
			return;
		}

		console.error( exit.cause );
		setError( "Something went wrong!" );
	};

	// `registerVerify` / `loginVerify` set the session cookie, and the atoms'
	// "me" reactivity key refetches the session, so the navbar swaps itself.
	const submit = async () => {
		setError( null );

		if ( mode === "register" ) {
			const input = RegisterInput.make( { name: name.trim(), username: username.trim() } );
			return finish( await register( input ) );
		}

		return finish( await login() );
	};

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
					{ mode === "register" ? (
						<Fragment>
							<label>Name</label>
							<Input
								type={ "text" }
								value={ name }
								onChange={ ( e ) => setName( e.target.value ) }
								placeholder={ "Enter your name" }
							/>
							<label>Email</label>
							<Input
								type={ "email" }
								autoComplete={ "username webauthn" }
								value={ username }
								onChange={ ( e ) => setUsername( e.target.value ) }
								placeholder={ "Enter your username" }
							/>
						</Fragment>
					) : (
						<p className={ "text-sm text-muted-foreground" }>
							Use your device passkey to sign in.
						</p>
					) }
					{ !supportsPasskeys && (
						<p className={ "text-sm text-destructive" }>
							This browser doesn't support passkeys.
						</p>
					) }
					{ error && <p className={ "text-sm text-destructive" }>{ error }</p> }
					<div className={ "flex items-center gap-3" }>
						<p className={ "text-sm text-muted-foreground" }>
							{ mode === "login" ? "New here?" : "Already have a passkey?" }
						</p>
						<button
							type={ "button" }
							className={ "text-sm text-accent underline cursor-pointer" }
							onClick={ () => {
								setError( null );
								setMode( mode === "register" ? "login" : "register" );
							} }
						>
							{ mode === "register" ? "Sign in" : "Create an account" }
						</button>
					</div>
				</div>
				<DialogFooter>
					<Button
						className={ "flex gap-2 items-center" }
						onClick={ submit }
						disabled={ isPending || !supportsPasskeys || !isValidInput() }
					>
						{ isPending ? <Spinner/> : (
							<Fragment>
								{ mode === "register" ? "REGISTER" : "LOGIN" }
								<LogInIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
							</Fragment>
						) }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
