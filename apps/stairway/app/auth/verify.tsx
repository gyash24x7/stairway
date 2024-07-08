import {useVerificationMutation} from "@auth/ui";
import {Spinner, VStack} from "@gluestack-ui/themed";
import {router, useLocalSearchParams} from "expo-router";
import {useEffect} from "react";

export default function VerificationScreen() {
	const {id, code} = useLocalSearchParams<{ id: string, code: string }>();
	const {mutateAsync} = useVerificationMutation();

	useEffect(() => {
		if (id && code) {
			mutateAsync({id, code}).then(() => router.replace("/auth/login"))
		}
	}, []);

	return (
		<VStack width={"100%"} height={"100%"} justifyContent={"center"} p={"$10"} gap={"$5"}>
			<Spinner size="large"/>
		</VStack>
	);
}
