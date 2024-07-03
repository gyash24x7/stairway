import { useIsLoggedIn } from "@auth/ui";
import { KeyboardAvoidingView, SafeAreaView, StatusBar } from "@gluestack-ui/themed";
import { Navbar } from "@shared/ui";
import { WordleTrpcProvider } from "@wordle/ui";
import { Redirect, Slot } from "expo-router";

export default function WordleLayout() {
	const isLoggedIn = useIsLoggedIn();

	if ( !isLoggedIn ) {
		return <Redirect href={ "/auth/login" }/>;
	}

	return (
		<SafeAreaView>
			<StatusBar barStyle={ "dark-content" }/>
			<Navbar/>
			<WordleTrpcProvider>
				<KeyboardAvoidingView>
					<Slot/>
				</KeyboardAvoidingView>
			</WordleTrpcProvider>
		</SafeAreaView>
	);
}