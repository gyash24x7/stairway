import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import { cardClassnames as classnames } from "../styles/components.css";

export type CardProps = {
	children: ReactNode;
	stretch?: boolean;
}

export function Card( { stretch, children }: CardProps ) {
	return (
		<Box className={ classnames.root( { stretch } ) }>
			{ children }
		</Box>
	);
}