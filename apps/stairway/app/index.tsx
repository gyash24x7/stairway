import { useIsLoggedIn } from "@auth/ui";
import { Button, ButtonText, SafeAreaView, ScrollView, StatusBar, VStack } from "@gluestack-ui/themed";
import { ApplicationCard, Navbar } from "@shared/ui";
import { Link } from "expo-router";

export default function HomeScreen() {
	const isLoggedIn = useIsLoggedIn();
	return (
		<SafeAreaView>
			<Navbar/>
			<StatusBar barStyle={ "dark-content" }/>
			<ScrollView w={ "100%" } h={ "100%" }>
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
			</ScrollView>
		</SafeAreaView>
	);
}
