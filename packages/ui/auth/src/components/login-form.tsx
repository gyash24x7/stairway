import {
	AlertCircleIcon,
	Button,
	ButtonSpinner,
	ButtonText,
	FormControl,
	FormControlError,
	FormControlErrorIcon,
	FormControlErrorText,
	FormControlLabel,
	FormControlLabelText,
	Input,
	InputField,
	InputIcon,
	InputSlot
} from "@gluestack-ui/themed";
import { router } from "expo-router";
import { EyeIcon, EyeOffIcon, MailIcon } from "lucide-react-native";
import { Fragment, useState } from "react";
import { useLoginHandler, useLoginMutation } from "../store";

export const LoginForm = () => {
	const handleLogin = useLoginHandler();
	const [ email, setEmail ] = useState( "" );
	const [ password, setPassword ] = useState( "" );
	const [ showPass, setShowPass ] = useState( false );

	const togglePasswordVisibility = () => setShowPass( !showPass );

	const { mutateAsync, isPending } = useLoginMutation();
	const handleSubmit = async () => mutateAsync( { email, password } ).then( async ( data ) => {
		await handleLogin( data );
		router.replace( "/" );
	} );

	return (
		<Fragment>
			<FormControl size="lg" isRequired>
				<FormControlLabel mb="$1">
					<FormControlLabelText>Email</FormControlLabelText>
				</FormControlLabel>
				<Input>
					<InputField
						type="text"
						placeholder="Enter your email"
						value={ email }
						onChangeText={ setEmail }
					/>
					<InputSlot>
						<InputIcon as={ MailIcon } px={ "$5" }/>
					</InputSlot>
				</Input>
				<FormControlError>
					<FormControlErrorIcon as={ AlertCircleIcon }/>
					<FormControlErrorText>Invalid Email</FormControlErrorText>
				</FormControlError>
			</FormControl>
			<FormControl size={ "lg" } isRequired>
				<FormControlLabel mb="$1">
					<FormControlLabelText>Password</FormControlLabelText>
				</FormControlLabel>
				<Input>
					<InputField
						type={ showPass ? "text" : "password" }
						placeholder="Enter your password"
						value={ password }
						onChangeText={ setPassword }
					/>
					<InputSlot onPress={ togglePasswordVisibility }>
						<InputIcon as={ !showPass ? EyeIcon : EyeOffIcon } px={ "$5" }/>
					</InputSlot>
				</Input>
				<FormControlError>
					<FormControlErrorIcon as={ AlertCircleIcon }/>
					<FormControlErrorText>
						At least 6 characters are required.
					</FormControlErrorText>
				</FormControlError>
			</FormControl>
			<Button onPress={ handleSubmit } isDisabled={ isPending }>
				{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>LOGIN</ButtonText> }
			</Button>
		</Fragment>
	);
};