import type { ReactNode } from "react";
import { Box } from "@mantine/core";
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