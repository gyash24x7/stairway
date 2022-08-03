import type { Size } from "../utils/types";
import { Flex } from "../flex/flex";
import type { ReactNode } from "react";
import React, { Children, isValidElement } from "react";
import { VariantSchema } from "../utils/variant";

export interface HStackProps {
	spacing?: Size;
	className?: string;
	centered?: boolean;
	stackItemClassName?: string;
	children: ReactNode;
	wrap?: boolean;
	stackItemExpand?: boolean;
}

const hStackFlexVS = new VariantSchema(
	"",
	{ spacing: { xs: "-mx-1", sm: "-mx-2", md: "-mx-3", lg: "-mx-4", xl: "-mx-5", "2xl": "-mx-6" } },
	{ spacing: "md" }
);

const hStackItemVs = new VariantSchema(
	"flex items-center",
	{
		spacing: { xs: "mx-1", sm: "mx-2", md: "mx-3", lg: "mx-4", xl: "mx-5", "2xl": "mx-6" },
		expand: { true: "flex-1", false: "" }
	},
	{ spacing: "md", expand: "false" }
);

export const HStack = function ( { children, ...props }: HStackProps ) {
	const validChildren = Children.toArray( children ).filter( ( child ) => isValidElement( child ) );
	const stackItemClassname = hStackItemVs.getClassname( {
		expand: props.stackItemExpand ? "true" : "false",
		spacing: props.spacing
	} );

	return (
		<Flex
			justify = { props.centered ? "center" : "start" }
			align = { "center" }
			className = { `${ hStackFlexVS.getClassname( { spacing: props.spacing } ) } ${ props.className }` }
			wrap = { props.wrap }
		>
			{ validChildren.map( ( child, index ) => (
				<div className = { `${ stackItemClassname } ${ props.stackItemClassName }` } key = { index }>
					{ child }
				</div>
			) ) }
		</Flex>
	);
};

