import type { Size } from "../utils/types";
import React, { Children, isValidElement, ReactNode } from "react";
import { VariantSchema } from "../utils/variant";

export interface VStackProps {
	spacing?: Size;
	className?: string;
	centered?: boolean;
	stackItemClassName?: string;
	children: ReactNode;
}

const vStackItemVS = new VariantSchema(
	"last-of-type:mb-0",
	{
		spacing: { xs: "mb-1", sm: "mb-2", md: "mb-3", lg: "mb-4", xl: "mb-5", "2xl": "mb-6" },
		centered: { true: "flex justify-center", false: "" }
	},
	{ spacing: "md", centered: "false" }
);

export const VStack = function ( { children, ...props }: VStackProps ) {
	const validChildren = Children.toArray( children ).filter( ( child ) => isValidElement( child ) );
	const stackItemClassname = vStackItemVS.getClassname( {
		centered: props.centered ? "true" : "false",
		spacing: props.spacing
	} );

	return (
		<div className = { props.className }>
			{ validChildren.map( ( child, index ) => (
				<div className = { `${ stackItemClassname } ${ props.stackItemClassName }` } key = { index }>
					{ child }
				</div>
			) ) }
		</div>
	);
};