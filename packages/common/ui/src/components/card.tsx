import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import { cardClassnames } from "../styles";

export type CardProps = {
	children: ReactNode;
	stretch?: boolean;
}

export function Card( { stretch, children }: CardProps ) {
	return (
		<Box className={ cardClassnames.root( { stretch } ) }>
			{ children }
		</Box>
	);
}