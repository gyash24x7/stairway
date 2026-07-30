import { useNavigate } from "@tanstack/react-router";
import { LogInIcon } from "lucide-react";
import { Fragment, useState, useTransition } from "react";

import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/shared/ui/primitives/dialog.tsx";
import { Input } from "@/shared/ui/primitives/input.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { loginPasskeyFn, registerPasskeyFn } from "@/auth/client/client.ts";
import { useRefreshAuth } from "@/auth/client/use-auth.tsx";

export function Login() {
	const navigate = useNavigate();
	const refreshAuth = useRefreshAuth();
	const [ isPending, startTransition ] = useTransition();
	const [ mode, setMode ] = useState<"login" | "register">( "login" );
	const [ open, setOpen ] = useState( false );
	const [ email, setEmail ] = useState( "" );
	const [ name, setName ] = useState( "" );
	const [ error, setError ] = useState<string | null>( null );

	const finishAuth = async () => {
		await refreshAuth();
		setOpen( false );
		await navigate( { to: "/" } );
	};

	const isValidInput = () => mode === "register"
		? !!name.trim() && /.+@.+/.test( email )
		: true;

	const submit = () => startTransition( async () => {
		setError( null );
		try {
			if ( mode === "register" ) {
				await registerPasskeyFn( { name: name.trim(), email: email.trim() } );
			} else {
				await loginPasskeyFn();
			}
			await finishAuth();
		} catch ( err ) {
			console.error( err );
			setError( err instanceof Error ? err.message : "Something went wrong." );
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
								value={ email }
								onChange={ ( e ) => setEmail( e.target.value ) }
								placeholder={ "Enter your email" }
							/>
						</Fragment>
					) : (
						<p className={ "text-sm text-muted-foreground" }>
							Use your device passkey to sign in.
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
						disabled={ isPending || !isValidInput() }
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
