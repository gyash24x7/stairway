import { Button, Container, Group, Text, Title } from "@mantine/core";
import { errorPageClassnames as classnames } from "../styles";

export function ErrorPage() {
	return (
		<Container className={ classnames.root }>
			<div className={ classnames.label }>404</div>
			<Title className={ classnames.title }>You have found a secret place.</Title>
			<Text c="dimmed" size="lg" ta="center" className={ classnames.description }>
				Unfortunately, this is only a 404 page. You may have mistyped the address, or the page has
				been moved to another URL.
			</Text>
			<Group justify="center">
				<Button variant="subtle" size="md">
					Take me back to home page
				</Button>
			</Group>
		</Container>
	);
}