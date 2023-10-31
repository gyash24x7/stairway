import { Alert, Button, Flex, PasswordInput, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Link, useNavigate } from "react-router-dom";
import { pageClassnames as classnames } from "../styles";
import { emailValidator, minLengthValidator, requiredValidator, useSignUpAction } from "../utils";
import { Fragment } from "react";

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

	const { execute, isLoading, error, data } = useSignUpAction();

	const handleSignup = onSubmit( values => execute( values ).then( () => navigate( "/auth/login" ) ) );

	return (
		<Fragment>
			<Title order={ 1 } className={ classnames.title } ta={ "center" } mt={ "md" } mb={ 50 }>
				SIGNUP
			</Title>

			<form noValidate onSubmit={ handleSignup }>
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

			<Flex justify={ "space-between" }>
				<Text>Already have an account?</Text>
				<Link to={ "/auth/login" }>
					<b>Login</b>
				</Link>
			</Flex>
			{ !!data && <Alert title={ "Woohoo!" } color={ "green" }>Verification Email Has Been Sent!</Alert> }
			{ !!error && <Alert title={ "Bummer!" } color={ "red" }>Something went wrong!</Alert> }
		</Fragment>
	);
}
