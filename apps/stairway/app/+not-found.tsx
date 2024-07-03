import { Box, SafeAreaView, Text } from "@gluestack-ui/themed";
import { Stack } from "expo-router";

export default function NotFoundScreen() {
	return (
		<>
			<Stack.Screen options={ { title: "Oops!" } }/>
			<SafeAreaView>
				<Box width="100%" justifyContent="center" alignItems="center">
					<Text>Open up App.js to start working on your app! Yahoo!</Text>
				</Box>
			</SafeAreaView>
		</>
	);
}
