"use client";

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
import { orpc } from "@/shared/utils/client";
import { cn } from "@/shared/utils/cn";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogInIcon } from "lucide-react";
import { type FormEvent, Fragment, useState, useTransition } from "react";

export function Login() {
	const [ isPending, startTransition ] = useTransition();
	const [ mode, setMode ] = useState<"login" | "register">( "login" );
	const [ open, setOpen ] = useState( false );
	const [ username, setUsername ] = useState( "" );
	const [ name, setName ] = useState( "" );
	const navigate = useNavigate();

	const userExistsMutation = useMutation( orpc.auth.userExists.mutationOptions() );
	const getRegistrationOptionsMutation = useMutation( orpc.auth.getRegistrationOptions.mutationOptions() );
	const getLoginOptionsMutation = useMutation( orpc.auth.getLoginOptions.mutationOptions() );
	const verifyRegistrationMutation = useMutation( orpc.auth.verifyRegistration.mutationOptions() );
	const verifyLoginMutation = useMutation( orpc.auth.verifyLogin.mutationOptions() );

	const passkeyLogin = async () => {
		const exists = await userExistsMutation.mutateAsync( username );
		if ( !exists ) {
			console.log( "User does not exist, switching to register mode" );
			setMode( "register" );
			return;
		}

		console.log( "User exists, proceeding with login" );
		const optionsJSON = await getLoginOptionsMutation.mutateAsync( { username } );
		const response = await startAuthentication( { optionsJSON } );
		await verifyLoginMutation.mutateAsync( { username, response } );

		console.log( "Login successful!" );
		await navigate( { to: "/" } );
	};

	const passkeyRegister = async () => {
		const optionsJSON = await getRegistrationOptionsMutation.mutateAsync( { username, name } );
		const response = await startRegistration( { optionsJSON } );
		await verifyRegistrationMutation.mutateAsync( { username, name, response } );

		console.log( "Register successful!" );
		await navigate( { to: "/" } );
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
				<Button>LOGIN</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg overscroll-y-auto" }>
					<DrawerHeader>
						<DrawerTitle className={ cn( "text-2xl" ) }>
							{ mode === "register" ? "REGISTER" : "LOGIN" }
						</DrawerTitle>
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
							disabled={ isPending || !isValidInput() }
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