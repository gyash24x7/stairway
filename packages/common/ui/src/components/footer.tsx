import { AppShell, Container, Flex } from "@mantine/core";
import type { ReactNode } from "react";
import classnames from "../styles/components.module.css";

export function AppFooter( props: { children: ReactNode } ) {
	return (
		<AppShell.Footer className={ classnames[ "layoutFooter" ] }>
			<div className={ classnames[ "layoutInner" ] }>
				<Container>
					<Flex mih={ 100 } justify={ "space-between" } c={ "white" } align={ "center" }>
						{ props.children }
					</Flex>
				</Container>
			</div>
		</AppShell.Footer>
	);
}