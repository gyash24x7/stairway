import { useIsLoggedIn } from "@auth/ui";
import { Redirect, Slot } from "expo-router";

export default function AuthLayout() {
	const isLoggedIn = useIsLoggedIn();

	if ( isLoggedIn ) {
		return <Redirect href={ "/" }/>;
	}

	return <Slot/>;
}