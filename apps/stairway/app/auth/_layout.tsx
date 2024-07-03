import { useIsLoggedIn } from "@auth/ui";
import { KeyboardAvoidingView, SafeAreaView, StatusBar } from "@gluestack-ui/themed";
import { Redirect, Slot } from "expo-router";

export default function AuthLayout() {
	const isLoggedIn = useIsLoggedIn();

	if ( isLoggedIn ) {
		return <Redirect href={ "/" }/>;
	}

	return (
		<SafeAreaView>
			<StatusBar barStyle={ "dark-content" }/>
			<KeyboardAvoidingView behavior={ "padding" }>
				<Slot/>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}