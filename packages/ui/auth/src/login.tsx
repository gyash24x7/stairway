import { Button } from "@s2h-ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@s2h-ui/primitives/drawer";
import { LogInIcon } from "@s2h-ui/primitives/icons";
import { Input } from "@s2h-ui/primitives/input";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import {
	useGetLoginOptionsMutation,
	useGetRegistrationOptionsMutation,
	useUserExistMutation,
	useVerifyLoginMutation,
	useVerifyRegistrationMutation
} from "@s2h/client/auth";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { type FormEvent, Fragment, useState, useTransition } from "react";

export function Login() {
	const [ isPending, startTransition ] = useTransition();
	const [ mode, setMode ] = useState<"login" | "register">( "login" );
	const [ open, setOpen ] = useState( false );
	const [ username, setUsername ] = useState( "" );
	const [ name, setName ] = useState( "" );

	const userExistsMutation = useUserExistMutation();
	const getRegistrationOptionsMutation = useGetRegistrationOptionsMutation();
	const getLoginOptionsMutation = useGetLoginOptionsMutation();
	const verifyRegistrationMutation = useVerifyRegistrationMutation();
	const verifyLoginMutation = useVerifyLoginMutation();

	const passkeyLogin = async () => {
		const { exists } = await userExistsMutation.mutateAsync( { username } );
		if ( !exists ) {
			setMode( "register" );
			return;
		}

		const optionsJSON = await getLoginOptionsMutation.mutateAsync( { username } );
		const response = await startAuthentication( { optionsJSON } );
		await verifyLoginMutation.mutateAsync( { username, response } );
		window.location.href = "/";
	};

	const passkeyRegister = async () => {
		const optionsJSON = await getRegistrationOptionsMutation.mutateAsync( { username, name } );
		const response = await startRegistration( { optionsJSON } );
		await verifyRegistrationMutation.mutateAsync( { username, name, response } );
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