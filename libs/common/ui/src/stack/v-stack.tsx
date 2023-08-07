import { ReactNode, useMemo } from "react";
import type { Size } from "../utils/index.js";
import { VariantSchema } from "../utils/index.js";

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
		spacing: { xs: "mb-1", sm: "mb-2", md: "mb-4", lg: "mb-6", xl: "mb-8", "2xl": "mb-9" },
		centered: { true: "flex justify-center", false: "" }
	},
	{ spacing: "md", centered: "false" }
);

export function VStack( { children, ...props }: VStackProps ) {
	const stackItemClassname = useMemo( () => {
		const vStackItemClassname = vStackItemVS.getClassname( {
			centered: props.centered ? "true" : "false",
			spacing: props.spacing
		} );

		return `${ vStackItemClassname } ${ props.stackItemClassName }`;
	}, [ props.stackItemClassName, props.spacing, props.centered ] );

	const stackItems = Array.isArray( children ) ? children : [ children ];

	return (
		<div className={ props.className }>
			{ stackItems.map( ( child, index ) => (
				<div className={ stackItemClassname } key={ index }>{ child }</div>
			) ) }
		</div>
	);
}