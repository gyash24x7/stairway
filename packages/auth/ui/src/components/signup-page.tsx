import { useNavigate } from "react-router-dom";
import { Alert, Anchor, Button, PasswordInput, Text, TextInput, Title } from "@mantine/core";
import { emailValidator, minLengthValidator, requiredValidator, useAuthStore } from "../utils";
import { useForm } from "@mantine/form";
import { AuthLayout } from "../components";
import { pageClassnames as classnames } from "../styles";
import type { MouseEvent } from "react";
import { useAction } from "@s2h/ui";
import type { CreateUserInput } from "@auth/types";

export function SignUpPage() {
	const signUp = useAuthStore( store => store.signUp );
	const navigate = useNavigate();
	const { getInputProps, onSubmit } = useForm( {
		initialValues: {
			name: "",
			email: "",
			password: ""
		},
		validate: {
			name: requiredValidator( "Name is required!" ),
			email: emailValidator( "Invalid Email!" ),
			password: minLengthValidator( 7, "Password too Short!" )
		}
	} );

	const { execute, isLoading, error, data } = useAction(
		async ( data: CreateUserInput ) => {
			await signUp( data );
			navigate( "/auth/login" );
		}
	);

	const goToLogin = ( e: MouseEvent<HTMLAnchorElement> ) => {
		e.preventDefault();
		navigate( "/auth/login" );
	};

	return (
		<AuthLayout>
			<Title order={ 1 } className={ classnames.title } ta={ "center" } mt={ "md" } mb={ 50 }>
				SIGNUP
			</Title>

			<form noValidate onSubmit={ onSubmit( ( values ) => execute( values ) ) }>
				<TextInput
					label={ "Name" }
					placeholder={ "Enter your Name" }
					size="md"
					withAsterisk
					{ ...getInputProps( "name" ) }
				/>

				<TextInput
					label={ "Email" }
					placeholder={ "Enter your Email" }
					size="md"
					mt={ "md" }
					withAsterisk
					{ ...getInputProps( "email" ) }
					type={ "email" }
				/>

				<PasswordInput
					label={ "Password" }
					placeholder={ "Enter your Password" }
					mt={ "md" }
					size={ "md" }
					withAsterisk
					{ ...getInputProps( "password" ) }
				/>

				<Button fullWidth mt={ "xl" } size={ "md" } type={ "submit" } loading={ isLoading }>
					Sign Up
				</Button>
			</form>

			<Text ta={ "center" } mt={ "md" }>
				Already have an account?{ " " }
				<Anchor<"a"> onClick={ goToLogin }>
					<b>Login</b>
				</Anchor>
			</Text>
			{ !!data && <Alert title={ "Woohoo!" } color={ "green" }>Verification Email Has Been Sent!</Alert> }
			{ !!error && <Alert title={ "Bummer!" } color={ "red" }>Something went wrong!</Alert> }
		</AuthLayout>
	);
}
