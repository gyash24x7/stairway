import { useIsLoggedIn } from "@auth/ui";
import { SafeAreaView, StatusBar } from "@gluestack-ui/themed";
import { LiteratureTrpcProvider } from "@literature/ui";
import { Navbar } from "@shared/ui";
import { Redirect, Slot } from "expo-router";

export default function LiteratureLayout() {
	const isLoggedIn = useIsLoggedIn();

	if ( !isLoggedIn ) {
		return <Redirect href={ "/auth/login" }/>;
	}

	return (
		<SafeAreaView>
			<StatusBar barStyle={ "dark-content" }/>
			<Navbar/>
			<LiteratureTrpcProvider>
				<Slot/>
			</LiteratureTrpcProvider>
		</SafeAreaView>
	);
}