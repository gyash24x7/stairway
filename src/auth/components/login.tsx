"use client";
import {
	checkIfUserExists,
	generateWebAuthnLoginOptions,
	generateWebAuthnRegistrationOptions,
	verifyWebAuthnLogin,
	verifyWebAuthnRegistration
} from "@/auth/server/functions";
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
import { useRouter } from "next/navigation";
import { type FormEvent, Fragment, useState, useTransition } from "react";

export function Login() {
	const [ isPending, startTransition ] = useTransition();
	const [ mode, setMode ] = useState<"login" | "register">( "login" );
	const [ open, setOpen ] = useState( false );
	const [ username, setUsername ] = useState( "" );
	const [ name, setName ] = useState( "" );

	const router = useRouter();

	const passkeyLogin = async () => {
		// 1. Get a challenge from the worker
		// const options = await startPasskeyLogin( username );
		const existingUser = await checkIfUserExists( username );
		if ( !existingUser ) {
			console.log( "User does not exist, switching to register mode" );
			setMode( "register" );
			return;
		}

		console.log( "User exists, proceeding with login" );
		const { success, message, data } = await generateWebAuthnLoginOptions( username );

		if ( !success || !data ) {
			console.error( message );
			alert( message ?? "Something went wrong!" );
			return;
		}

		const localResponse = await startAuthentication( { optionsJSON: data } );
		const verifyResponse = await verifyWebAuthnLogin( localResponse );

		if ( !verifyResponse.success ) {
			console.error( verifyResponse.message );
			alert( verifyResponse.message ?? "Something went wrong!" );
			return;
		}

		console.log( "Login successful!" );
		router.refresh();
	};

	const passkeyRegister = async ( username: string ) => {
		const { success, data, message } = await generateWebAuthnRegistrationOptions( username );

		if ( !success || !data ) {
			console.error( message );
			alert( message ?? "Something went wrong!" );
			return;
		}

		const localResponse = await startRegistration( { optionsJSON: data } );
		const verifyResponse = await verifyWebAuthnRegistration( localResponse );

		if ( !verifyResponse.success ) {
			console.error( verifyResponse.message );
			alert( verifyResponse.message ?? "Something went wrong!" );
			return;
		}

		console.log( "Register successful!" );
		router.refresh();
	};

	const performPasskeyLogin = () => {
		startTransition( () => {
			if ( mode === "register" ) {
				if ( !username || !name ) {
					alert( "Please enter a username and name to register." );
					return;
				} else {
					void passkeyRegister( username );
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
						<label>Username</label>
						<Input
							type={ "text" }
							value={ username }
							onInput={ handleUsernameInput }
							placeholder={ "Enter your username" }
						/>
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