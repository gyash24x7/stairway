import { Box, Button, Paper, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { applicationCardClassnames as classnames } from "../styles";

export interface ApplicationCardProps {
	category: string;
	name: string;
	path: string;
}

export function ApplicationCard( props: ApplicationCardProps ) {
	const navigate = useNavigate();

	return (
		<Paper shadow={ "md" } p={ "xl" } radius={ "md" } className={ classnames.card } c={ "white" }>
			<Box>
				<Text fz={ 14 } fw={ 700 } lh={ 1 }>{ props.category.toUpperCase() }</Text>
				<Title fz={ 56 } lh={ 1 }>{ props.name.toUpperCase() }</Title>
			</Box>
			<Button color={ "brand" } onClick={ () => navigate( props.path ) } fw={ 700 }>PLAY</Button>
		</Paper>
	);
}