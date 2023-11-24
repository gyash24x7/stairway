import { Box } from "@mantine/core";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import classnames from "../styles/components.module.css";

export type CardProps = {
	children: ReactNode;
	stretch?: boolean;
}

export function Card( { stretch, children }: CardProps ) {
	return (
		<Box className={ clsx( classnames[ "cardRoot" ], stretch && classnames[ "cardRootStretch" ] ) }>
			{ children }
		</Box>
	);
}