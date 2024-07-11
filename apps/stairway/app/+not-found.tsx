import { Box, Button, SafeAreaView, Text } from "@gluestack-ui/themed";
import { router } from "expo-router";

export default function NotFoundScreen() {
	const goHome = () => router.replace( "/" )

	return (
		<SafeAreaView>
			<Box width="100%" justifyContent="center" alignItems="center" p={ "$5" }>
				<Text>You've reached an unknown location</Text>
			</Box>
		</SafeAreaView>
	);
}
