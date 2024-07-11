import { useIsLoggedIn } from "@auth/ui";
import { LiteratureTrpcProvider } from "@literature/ui";
import { Redirect, Slot } from "expo-router";

export default function LiteratureLayout() {
	const isLoggedIn = useIsLoggedIn();

	if ( !isLoggedIn ) {
		return <Redirect href={ "/auth/login" }/>;
	}

	return (
		<LiteratureTrpcProvider>
			<Slot/>
		</LiteratureTrpcProvider>
	);
}