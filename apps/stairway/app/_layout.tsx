import { AuthProvider } from "@auth/ui";
import { FjallaOne_400Regular } from "@expo-google-fonts/fjalla-one";
import { OpenSans_400Regular, OpenSans_800ExtraBold } from "@expo-google-fonts/open-sans";
import { config } from "@gluestack-ui/config";
import { GluestackUIProvider, KeyboardAvoidingView, SafeAreaView, ScrollView, StatusBar } from "@gluestack-ui/themed";
import { Navbar, queryClient } from "@shared/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().then();

export default function RootLayout() {
	const [ loaded ] = useFonts( {
		fjalla: FjallaOne_400Regular,
		sans: OpenSans_400Regular,
		sansBold: OpenSans_800ExtraBold
	} );

	useEffect( () => {
		if ( loaded ) {
			SplashScreen.hideAsync().then();
		}
	}, [ loaded ] );

	if ( !loaded ) {
		return null;
	}

	return (
		<GluestackUIProvider config={ config }>
			<QueryClientProvider client={ queryClient }>
				<AuthProvider>
					<SafeAreaView>
						<StatusBar barStyle={ "dark-content" }/>
						<Navbar/>
					</SafeAreaView>
					<ScrollView h={"100%"}>
						<KeyboardAvoidingView>
							<Slot/>
						</KeyboardAvoidingView>
					</ScrollView>
				</AuthProvider>
			</QueryClientProvider>
		</GluestackUIProvider>
	);
}
