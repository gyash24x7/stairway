import { Button, ButtonIcon, Center, Heading } from "@gluestack-ui/themed";
import { Link } from "expo-router";
import { CogIcon, HomeIcon } from "lucide-react-native";

export const Navbar = () => {
	return (
		<Center
			px={ "$5" }
			pb={ "$2" }
			flexDirection={ "row" }
			justifyContent={ "space-between" }
			alignItems={ "center" }
			borderBottomWidth={ 4 }
		>
			<Link asChild href={ "/" }>
				<Button variant={ "link" }>
					<ButtonIcon as={ HomeIcon } color={ "primary" } size={ "xl" }/>
				</Button>
			</Link>
			<Heading size={ "4xl" } fontFamily={ "fjalla" }>STAIRWAY</Heading>
			<Link asChild href={ "/settings" }>
				<Button variant={ "link" }>
					<ButtonIcon as={ CogIcon } color={ "primary" } size={ "xl" }/>
				</Button>
			</Link>
		</Center>
	);
};