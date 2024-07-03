import { useAuthInfo, useIsLoggedIn, useLogoutHandler } from "@auth/ui";
import {
	Avatar,
	AvatarFallbackText,
	AvatarImage,
	Button,
	ButtonText,
	Heading,
	HStack,
	SafeAreaView,
	ScrollView,
	StatusBar,
	Text,
	VStack
} from "@gluestack-ui/themed";
import { Navbar } from "@shared/ui";
import { Link } from "expo-router";
import { Fragment } from "react";

export default function SettingsScreen() {
	const authInfo = useAuthInfo();
	const isLoggedIn = useIsLoggedIn();
	const handleLogout = useLogoutHandler();

	return (
		<SafeAreaView>
			<Navbar/>
			<StatusBar barStyle={ "dark-content" }/>
			<ScrollView w={ "100%" } h={ "100%" }>
				<VStack width={ "100%" } gap={ "$5" } p={ "$5" }>
					<Heading size={ "3xl" } fontFamily={ "fjalla" }>SETTINGS</Heading>
					{ isLoggedIn ? (
						<Fragment>
							<HStack alignItems={ "center" } gap={ "$5" }>
								<Avatar bgColor="$amber600" size="xl" borderRadius="$full">
									<AvatarImage source={ { uri: authInfo?.avatar } } alt={ "" }/>
									{ !authInfo?.avatar && <AvatarFallbackText>{ authInfo?.name }</AvatarFallbackText> }
								</Avatar>
								<VStack>
									<Heading size="xl">{ authInfo?.name }</Heading>
									<Text>{ authInfo?.name }</Text>
								</VStack>
							</HStack>
							<Button action={ "negative" } onPress={ handleLogout }>
								<ButtonText>LOGOUT</ButtonText>
							</Button>
						</Fragment>
					) : (
						<Link asChild href={ "/auth/login" }>
							<Button>
								<ButtonText>LOGIN</ButtonText>
							</Button>
						</Link>
					) }
				</VStack>
			</ScrollView>
		</SafeAreaView>
	);
}
