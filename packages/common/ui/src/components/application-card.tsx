import { Button, Paper, Text, Title } from "@mantine/core";
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
		<Paper shadow={ "md" } p={ "xl" } radius={ "md" } className={ classnames.card }>
			<div>
				<Text className={ classnames.category } size={ "xs" }>{ props.category }</Text>
				<Title order={ 3 } className={ classnames.title }>{ props.name }</Title>
			</div>
			<Button color={ "primary" } onClick={ () => navigate( props.path ) }>Play</Button>
		</Paper>
	);
}