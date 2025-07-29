"use client";

import { checkIfUserExists, getLoginOptions, getRegistrationOptions } from "@/auth/server/functions";
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
import { cn } from "@/shared/utils/cn";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { LogInIcon } from "lucide-react";
import { type FormEvent, Fragment, useState, useTransition } from "react";
import { default as axios } from "redaxios";

export function Login() {
	const [ isPending, startTransition ] = useTransition();
	const [ mode, setMode ] = useState<"login" | "register">( "login" );
	const [ open, setOpen ] = useState( false );
	const [ username, setUsername ] = useState( "" );
	const [ name, setName ] = useState( "" );

	const passkeyLogin = async () => {
		const existingUser = await checkIfUserExists( { username } ).catch( err => {
			console.error( err.message );
			console.error( err.message ?? "Something went wrong!" );
		} );

		if ( !existingUser ) {
			console.log( "User does not exist, switching to register mode" );
			setMode( "register" );
			return;
		}

		console.log( "User exists, proceeding with login" );
		const { error, data } = await getLoginOptions( { username } );
		if ( error || !data ) {
			console.error( "Failed to get login options:", error );
			return;
		}

		const response = await startAuthentication( { optionsJSON: data } );

		const { url, status } = await axios.post(
			"/auth/login",
			{ username, response },
			{ withCredentials: true }
		);

		console.log( "Login successful!", url, status );
		window.location.href = url;
	};

	const passkeyRegister = async () => {
		const { error, data } = await getRegistrationOptions( { username } );

		if ( !!error || !data ) {
			console.error( "Failed to get registration options." );
			return;
		}

		const response = await startRegistration( { optionsJSON: data } ).catch( error => console.log( error ) );
		const { url, status } = await axios.post(
			"/auth/registration",
			{ username, name, response },
			{ withCredentials: true }
		);

		console.log( "Register successful!", url, status );
		window.location.href = url;
	};

	const performPasskeyLogin = () => {
		startTransition( () => {
			if ( mode === "register" ) {
				if ( !username || !name ) {
					alert( "Please enter a username and name to register." );
					return;
				} else {
					void passkeyRegister();
				}
			} else if ( !username ) {
				alert( "Please enter a username to login." );
				return;
			} else {
				void passkeyLogin();
			}
		} );
	};

	const handleUsernameInput = ( e: FormEvent<HTMLInputElement> ) => {
		e.preventDefault();
		setUsername( e.currentTarget.value );
	};

	const handleNameInput = ( e: FormEvent<HTMLInputElement> ) => {
		e.preventDefault();
		setName( e.currentTarget.value );
	};

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button className={ "w-full max-w-lg" }>LOGIN</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg overscroll-y-auto" }>
					<DrawerHeader>
						<DrawerTitle className={ cn( "text-2xl" ) }>LOGIN</DrawerTitle>
					</DrawerHeader>
					<div className={ "flex flex-col gap-3 px-4" }>
						<label>Username</label>
						<Input
							type={ "text" }
							value={ username }
							onInput={ handleUsernameInput }
							placeholder={ "Enter your username" }
						/>
						{ mode === "register" && (
							<Fragment>
								<label>Name</label>
								<Input
									type={ "text" }
									value={ name }
									onInput={ handleNameInput }
									placeholder={ "Enter your name" }
								/>
							</Fragment>
						) }
					</div>
					<DrawerFooter>
						<Button
							className={ "flex gap-2 items-center" }
							onClick={ performPasskeyLogin }
							disabled={ isPending || ( mode === "register" ? !username && !name : !username ) }
						>
							{ isPending ? <Spinner/> : (
								<Fragment>
									<Fragment>{ mode === "register" ? "REGISTER" : "LOGIN" }</Fragment>
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