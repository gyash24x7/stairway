"use client";

import {
	checkIfUserExists,
	getLoginOptions,
	getRegistrationOptions,
	verifyRegistration
} from "@/auth/server/functions";
import { verifyWebAuthnLogin } from "@/auth/server/service";
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
		const [ _, existingUser ] = await checkIfUserExists( { username } );
		if ( !existingUser ) {
			console.log( "User does not exist, switching to register mode" );
			setMode( "register" );
			return;
		}

		console.log( "User exists, proceeding with login" );
		const [ err, data ] = await getLoginOptions( { username } );

		if ( !!err || !data ) {
			console.error( err.message );
			alert( err.message ?? "Something went wrong!" );
			return;
		}

		const response = await startAuthentication( { optionsJSON: data } );
		await verifyWebAuthnLogin( { response, username } ).catch( err => {
			console.error( err.message );
			alert( err.message ?? "Something went wrong!" );
		} );

		console.log( "Login successful!" );
		router.refresh();
	};

	const passkeyRegister = async ( username: string ) => {
		const [ err1, data1 ] = await getRegistrationOptions( { username } );

		if ( !!err1 || !data1 ) {
			console.error( err1.message );
			alert( err1.message ?? "Something went wrong!" );
			return;
		}

		const response = await startRegistration( { optionsJSON: data1 } );

		const [ err2 ] = await verifyRegistration( { response, username, name } );
		if ( !!err2 ) {
			console.error( err2.message );
			alert( err2.message ?? "Something went wrong!" );
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