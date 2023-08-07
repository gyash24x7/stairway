import { useMemo } from "react";
import { Flex } from "../flex/index.js";
import type { Size } from "../utils/index.js";
import { VariantSchema } from "../utils/index.js";

export interface HStackProps {
	spacing?: Size;
	className?: string;
	centered?: boolean;
	stackItemClassName?: string;
	children: JSX.Element[] | JSX.Element;
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

export function HStack( { children, ...props }: HStackProps ) {
	const flexClassname = useMemo( () => {
		return `${ hStackFlexVS.getClassname( { spacing: props.spacing } ) } ${ props.className }`;
	}, [ props.spacing, props.className ] );

	const stackItemClassname = useMemo( () => {
		const hStackItemClassname = hStackItemVs.getClassname( {
			expand: props.stackItemExpand ? "true" : "false",
			spacing: props.spacing
		} );
		return `${ hStackItemClassname } ${ props.stackItemClassName }`;
	}, [ props.stackItemClassName, props.stackItemExpand, props.spacing ] );

	const stackItems = Array.isArray( children ) ? children : [ children ];

	return (
		<Flex
			justify={ props.centered ? "center" : "start" }
			align={ "center" }
			className={ flexClassname }
			wrap={ props.wrap }
		>
			{ stackItems.map( ( child, index ) => (
				<div className={ stackItemClassname } key={ index }>{ child }</div>
			) ) }
		</Flex>
	);
}

