import { useNavigate } from "react-router-dom";
import { useSignUpMutation } from "@auth/client";
import { Alert, Anchor, Button, PasswordInput, Text, TextInput, Title } from "@mantine/core";
import { emailValidator, minLengthValidator, requiredValidator } from "../utils";
import { useForm } from "@mantine/form";
import { AuthLayout } from "../components";
import { pageClassnames as classnames } from "../styles";
import type { MouseEvent } from "react";

export function SignUpPage() {
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

	const { mutateAsync, data, isPending, isError } = useSignUpMutation( {
		onSuccess() {
			navigate( "/auth/login" );
		}
	} );

	const goToLogin = ( e: MouseEvent<HTMLAnchorElement> ) => {
		e.preventDefault();
		navigate( "/auth/login" );
	};

	return (
		<AuthLayout>
			<Title order={ 1 } className={ classnames.title } ta={ "center" } mt={ "md" } mb={ 50 }>
				SIGNUP
			</Title>

			<form noValidate onSubmit={ onSubmit( ( values ) => mutateAsync( values ) ) }>
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

				<Button fullWidth mt={ "xl" } size={ "md" } type={ "submit" } loading={ isPending }>
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
			{ isError && <Alert title={ "Bummer!" } color={ "red" }>Something went wrong!</Alert> }
		</AuthLayout>
	);
}
