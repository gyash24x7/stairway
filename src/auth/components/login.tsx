"use client";
//
// import {
// 	finishPasskeyLogin,
// 	finishPasskeyRegistration,
// 	startPasskeyLogin,
// 	startPasskeyRegistration
// } from "@/auth/server/functions";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@/shared/primitives/drawer";
import { Input } from "@/shared/primitives/input";
import { Spinner } from "@/shared/primitives/spinner";
// import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { LogInIcon } from "lucide-react";
import { type FormEvent, Fragment, useState, useTransition } from "react";

export function Login() {
	const [ isPending, startTransition ] = useTransition();
	const [ open, setOpen ] = useState( false );
	const [ username, setUsername ] = useState( "" );
	const [ message, setMessage ] = useState( "" );

	const passkeyLogin = async () => {
		// 1. Get a challenge from the worker
		// const options = await startPasskeyLogin( username );

		// 2. Ask the browser to sign the challenge
		// const login = await startAuthentication( { optionsJSON: options } );

		// 3. Give the signed challenge to the worker to finish the login process
		// const success = await finishPasskeyLogin( login );

		// if ( !success ) {
		setMessage( "Login failed" );
		// } else {
		// 	setMessage( "Login successful!" );
		// }
	};

	const passkeyRegister = async () => {
		// 1. Get a challenge from the worker
		// const options = await startPasskeyRegistration( username );

		// 2. Ask the browser to sign the challenge
		// const registration = await startRegistration( { optionsJSON: options } );

		// 3. Give the signed challenge to the worker to finish the registration process
		// const success = await finishPasskeyRegistration( username, registration );

		// if ( !success ) {
		setMessage( "Registration failed" );
		// } else {
		// 	setMessage( "Registration successful!" );
		// }
	};

	const performPasskeyLogin = () => {
		startTransition( () => void passkeyLogin() );
	};

	const performPasskeyRegister = () => {
		startTransition( () => void passkeyRegister() );
	};

	const handleUsernameInput = ( e: FormEvent<HTMLInputElement> ) => {
		e.preventDefault();
		setUsername( e.currentTarget.value );
	};

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button className={ "w-full max-w-lg" }>LOGIN</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle>LOGIN</DrawerTitle>
					</DrawerHeader>
					<div className={ "flex flex-col gap-3" }>
						<Input
							type={ "text" }
							value={ username }
							onInput={ handleUsernameInput }
							placeholder={ "Enter your username" }
						/>
						<h2>{ message }</h2>
					</div>
					<DrawerFooter>
						<Button
							className={ "flex gap-2 items-center" }
							onClick={ performPasskeyLogin }
							disabled={ isPending || !username }
						>
							{ isPending ? <Spinner/> : (
								<Fragment>
									<Fragment>LOGIN</Fragment>
									<LogInIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
								</Fragment>
							) }
						</Button>
						<Button
							className={ "flex gap-2 items-center" }
							onClick={ performPasskeyRegister }
							disabled={ isPending || !username }
						>
							{ isPending ? <Spinner/> : (
								<Fragment>
									<Fragment>REGISTER</Fragment>
									<LogInIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
								</Fragment>
							) }
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}