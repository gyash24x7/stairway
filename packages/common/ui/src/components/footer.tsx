import { AppShell, Container, Flex } from "@mantine/core";
import type { ReactNode } from "react";
import { layoutClassnames as classnames } from "../styles";

export function AppFooter( props: { children: ReactNode } ) {
	return (
		<AppShell.Footer className={ classnames.footer }>
			<div className={ classnames.inner }>
				<Container>
					<Flex mih={ 100 } justify={ "space-between" } c={ "white" } align={ "center" }>
						{ props.children }
					</Flex>
				</Container>
			</div>
		</AppShell.Footer>
	);
}