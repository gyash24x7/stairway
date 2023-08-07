import { ExclamationCircleIcon, LockClosedIcon, UserIcon } from "@heroicons/react/24/solid";
import { Banner, Button, emailValidator, Flex, Form, minLengthValidator, TextInput, VStack } from "@s2h/ui";
import { useLoginMutation } from "@auth/client";
import { useAuth } from "../utils/index.js";
import { Link, useNavigate } from "react-router-dom";
import { When } from "react-if";

export function LoginPage() {
	const navigate = useNavigate();
	const { login } = useAuth();

	const { mutateAsync, isLoading, isError } = useLoginMutation( {
		onSuccess: () => {
			login();
			navigate( "/" );
		}
	} );

	return (
		<VStack className={ "h-screen p-8" }>
			<img src={ "/images/DarkLogo.png" } alt={ "Shaastra Logo" } className={ "w-60 h-auto mx-auto my-4" }/>
			<h2 className={ "font-light text-3xl" }>LOGIN</h2>
			<Form
				initialValue={ { email: "", password: "" } }
				onSubmit={ ( { password, email } ) => mutateAsync( { email, password } ) }
				submitBtn={ () => {
					return (
						<Button
							appearance={ "primary" }
							type={ "submit" }
							buttonText={ "Submit" }
							fullWidth
							isLoading={ isLoading }
						/>
					);
				} }
				renderMap={ {
					email: ( { appearance, error, ...props } ) => (
						<TextInput
							{ ...props }
							value={ props.value.toUpperCase() }
							setValue={ v => props.setValue( v.toLowerCase() ) }
							label={ "Roll Number" }
							placeholder={ "Enter your Roll Number" }
							renderIconAfter={ ( props ) => <UserIcon { ...props }/> }
							appearance={ appearance }
							message={ error }
						/>
					),
					password: ( { appearance, error, ...props } ) => (
						<TextInput
							{ ...props }
							type={ "password" }
							label={ "Password" }
							placeholder={ "Enter you Password" }
							renderIconAfter={ ( props ) => <LockClosedIcon { ...props }/> }
							appearance={ appearance }
							message={ error }
						/>
					)
				} }
				validations={ {
					email: [ emailValidator( "Invalid Email!" ) ],
					password: [ minLengthValidator( 7, "Password too Short!" ) ]
				} }
			/>
			<Flex justify={ "space-between" }>
				<span>Don't have an account?</span>
				<span>
					<Link to={ "/auth/signup" }>Signup</Link>
				</span>
			</Flex>
			<When condition={ isError }>
				<Banner
					message={ "Some Error!" }
					appearance={ "danger" }
					renderIcon={ ( props ) => <ExclamationCircleIcon { ...props }/> }
				/>
			</When>
		</VStack>
	);
}
