import { SignupForm } from "@auth/ui";
import { Box, Button, ButtonText, Center, Heading, Text, VStack } from "@gluestack-ui/themed";
import { Link } from "expo-router";

export default function SignUpScreen() {
	return (
		<VStack width={ "100%" } height={ "100%" } justifyContent={ "center" } p={ "$10" } gap={ "$5" }>
			<Center mb={ "$10" }>
				<Heading size={ "2xl" } fontFamily={ "sansBold" } fontWeight={ "$bold" }>SIGN UP</Heading>
			</Center>
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
