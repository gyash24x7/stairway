import type { LoginInput } from "@auth/types";
import { Alert, Anchor, Button, PasswordInput, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useAction } from "@s2h/ui";
import { IconAlertCircle } from "@tabler/icons-react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components";
import { pageClassnames as classnames } from "../styles";
import { emailValidator, minLengthValidator, useAuth } from "../utils";

export function LoginPage() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const { getInputProps, onSubmit } = useForm( {
		initialValues: {
			email: "",
			password: ""
		},
		validate: {
			email: emailValidator( "Invalid Email!" ),
			password: minLengthValidator( 7, "Password too Short!" )
		}
	} );

	const { execute, isLoading, error } = useAction(
		async ( data: LoginInput ) => {
			await login( data );
			navigate( "/" );
		}
	);

	const goToSignup = ( e: MouseEvent<HTMLAnchorElement> ) => {
		e.preventDefault();
		navigate( "/auth/signup" );
	};

	return (
		<AuthLayout>
			<Title order={ 1 } className={ classnames.title } ta={ "center" } mt={ "md" } mb={ 50 }>
				LOGIN
			</Title>

			<form noValidate onSubmit={ onSubmit( ( { email, password } ) => execute( { email, password } ) ) }>
				<TextInput
					label={ "Email" }
					placeholder={ "Enter your Email" }
					size="md"
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
					Login
				</Button>
			</form>

			<Text ta={ "center" } mt={ "md" }>
				Don&apos;t have an account?{ " " }
				<Anchor<"a"> onClick={ goToSignup }>
					<b>Register</b>
				</Anchor>
			</Text>
			{ !!error &&
				<Alert icon={ <IconAlertCircle/> } title="Bummer!" color="red" mt={ "md" }>
					Something went wrong!
				</Alert>
			}
		</AuthLayout>
	);
}
