import { useIsLoggedIn } from "@auth/ui";
import { WordleTrpcProvider } from "@wordle/ui";
import { Redirect, Slot } from "expo-router";

export default function WordleLayout() {
	const isLoggedIn = useIsLoggedIn();

	if ( !isLoggedIn ) {
		return <Redirect href={ "/auth/login" }/>;
	}

	return (
		<WordleTrpcProvider>
			<Slot/>
		</WordleTrpcProvider>
	);
}