import { Box, Heading, Image, Pressable } from "@gluestack-ui/themed";
import { Link } from "expo-router";

export type ApplicationCardProps = {
	name: string;
	path: string;
	image: number;
}

export const ApplicationCard = ( props: ApplicationCardProps ) => (
	<Link asChild href={ props.path }>
		<Pressable borderWidth={ "$4" } borderRadius={ "$md" }>
			<Image w={ "100%" } h={ "100%" } source={ props.image } position={ "absolute" } alt={ props.name }/>
			<Box w={ "100%" } h={ "100%" } bg={ "$black" } opacity={ "$40" } position={ "absolute" }/>
			<Box px={ "$5" } py={ "$10" }>
				<Heading size={ "4xl" } fontFamily={ "fjalla" } color={ "$white" }>
					{ props.name.toUpperCase() }
				</Heading>
			</Box>
		</Pressable>
	</Link>
);
