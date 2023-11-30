import { Button, Container, Group, Text, Title } from "@mantine/core";
import classnames from "../styles/components.module.css";

export function ErrorPage() {
	return (
		<Container className={ classnames[ "errorPageRoot" ] }>
			<div className={ classnames[ "errorPageLabel" ] }>404</div>
			<Title className={ classnames[ "errorPageTitle" ] }>You have found a secret place.</Title>
			<Text c="dimmed" size="lg" ta="center" className={ classnames[ "errorPageDescription" ] }>
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