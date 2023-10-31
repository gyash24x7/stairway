import { Alert, Button, Flex, PasswordInput, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import { pageClassnames as classnames } from "../styles";
import { emailValidator, minLengthValidator, useLoginAction } from "../utils";
import { Fragment } from "react";

export function LoginPage() {
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

	const { execute, isLoading, error } = useLoginAction();

	const handleLogin = onSubmit( input => execute( input ).then( () => navigate( "/" ) ) );

	return (
		<Fragment>
			<Title order={ 1 } className={ classnames.title } ta={ "center" } mt={ "md" } mb={ 50 }>
				LOGIN
			</Title>

			<form noValidate onSubmit={ handleLogin }>
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

			<Flex justify={ "space-between" }>
				<Text>Don&apos;t have an account?</Text>
				<Link to={ "/auth/signup" }>
					<b>Register</b>
				</Link>
			</Flex>

			{ !!error &&
				<Alert icon={ <IconAlertCircle/> } title="Bummer!" color="red" mt={ "md" }>
					Something went wrong!
				</Alert>
			}
		</Fragment>
	);
}
