import { useIsLoggedIn } from "@auth/ui";
import { Button, ButtonText, VStack } from "@gluestack-ui/themed";
import { ApplicationCard } from "@shared/ui";
import { Link } from "expo-router";

export default function HomeScreen() {
	const isLoggedIn = useIsLoggedIn();
	return (
		<VStack width={ "100%" } gap={ "$5" } p={ "$5" }>
			{ !isLoggedIn && (
				<Link asChild href={ "/auth/login" }>
					<Button>
						<ButtonText>LOGIN</ButtonText>
					</Button>
				</Link>
			) }
			<ApplicationCard
				name={ "literature" }
				path={ "/literature" }
				image={ require( "../assets/images/literature.jpg" ) }
			/>
			<ApplicationCard
				name={ "wordle" }
				path={ "/wordle" }
				image={ require( "../assets/images/wordle.jpg" ) }
			/>
		</VStack>
	);
}
