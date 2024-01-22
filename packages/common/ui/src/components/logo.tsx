import { Group, Title } from "@mantine/core";

export function Logo() {
	return (
		<Group>
			<img src={ "/logo.png" } width={ 72 } height={ 72 } alt={ "literature" }/>
			<Title order={ 1 } my={ 20 }>STAIRWAY</Title>
		</Group>
	);
}