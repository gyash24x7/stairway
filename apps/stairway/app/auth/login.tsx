import { LoginForm } from "@auth/ui";
import { Box, Button, ButtonText, Center, Heading, Text, VStack } from "@gluestack-ui/themed";
import { Link } from "expo-router";

export default function LoginScreen() {
	return (
		<VStack width={ "100%" } height={ "100%" } justifyContent={ "center" } p={ "$10" } gap={ "$5" }>
			<Center mb={ "$10" }>
				<Heading size={ "2xl" } fontFamily={ "sansBold" } fontWeight={ "$bold" }>SIGN UP</Heading>
			</Center>
			<LoginForm/>
			<Box flexDirection={ "row" } justifyContent={ "space-between" } alignItems={ "center" }>
				<Text>New to Stairway?</Text>
				<Link asChild href={ "/auth/signup" }>
					<Button variant={ "link" }>
						<ButtonText>SIGN UP</ButtonText>
					</Button>
				</Link>
			</Box>
		</VStack>
	);
}
