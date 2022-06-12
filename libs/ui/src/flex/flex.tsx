import type { ReactNode } from "react";
import React from "react";
import { VariantSchema } from "../utils/variant";

export interface FlexProps {
	className?: string;
	expand?: boolean;
	justify?: "center" | "start" | "end" | "space-between" | "space-around" | "space-evenly";
	align?: "center" | "start" | "end" | "baseline" | "stretch";
	direction?: "row" | "col" | "col-reverse" | "row-reverse";
	wrap?: boolean;
	children: ReactNode;
}

const flexVariantSchema = new VariantSchema(
	"flex",
	{
		direction: {
			row: "flex-row",
			col: "flex-col",
			"row-reverse": "flex-row-reverse",
			"col-reverse": "flex-col-reverse"
		},
		align: {
			start: "items-start",
			end: "items-end",
			baseline: "items-baseline",
			stretch: "items-stretch",
			center: "items-center"
		},
		justify: {
			start: "justify-start",
			end: "justify-end",
			center: "justify-center",
			"space-between": "justify-between",
			"space-around": "justify-around",
			"space-evenly": "justify-evenly"
		},
		wrap: { true: "flex-wrap", false: "" }
	},
	{ direction: "row", justify: "start", align: "start", wrap: "false" }
);

export function Flex( props: FlexProps ) {
	const baseClassName = flexVariantSchema.getClassname( {
		justify: props.justify || "start",
		align: props.align || "start",
		direction: props.direction || "row",
		wrap: props.wrap ? "true" : "false"
	} );

	return <div className = { baseClassName + ` ${ props.className }` }>{ props.children }</div>;
}