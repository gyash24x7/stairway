import { SignupForm } from "@auth/ui";
import { Box, Button, ButtonText, Heading, Text, VStack } from "@gluestack-ui/themed";
import { Link } from "expo-router";

export default function SignUpScreen() {
	return (
		<VStack width={ "100%" } height={ "100%" } justifyContent={ "center" } p={ "$10" } gap={ "$5" }>
			<Box alignItems={ "center" } mb={ "$10" }>
				<Heading size={ "4xl" } fontFamily={ "fjalla" }>STAIRWAY</Heading>
				<Heading size={ "2xl" } fontFamily={ "sansBold" } fontWeight={ "$bold" }>SIGN UP</Heading>
			</Box>
			<SignupForm/>
			<Box flexDirection={ "row" } justifyContent={ "space-between" } alignItems={ "center" }>
				<Text>Already have an account?</Text>
				<Link asChild href={ "/auth/login" }>
					<Button variant={ "link" }>
						<ButtonText>LOGIN</ButtonText>
					</Button>
				</Link>
			</Box>
		</VStack>
	);
}
