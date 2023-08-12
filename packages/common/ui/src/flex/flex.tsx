import { useMemo } from "react";
import { VariantSchema } from "../utils/index.js";

export interface FlexProps {
	className?: string;
	expand?: boolean;
	justify?: "center" | "start" | "end" | "space-between" | "space-around" | "space-evenly";
	align?: "center" | "start" | "end" | "baseline" | "stretch";
	direction?: "row" | "col" | "col-reverse" | "row-reverse";
	wrap?: boolean;
	children: JSX.Element[] | JSX.Element;
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
	const baseClassName = useMemo( () => flexVariantSchema.getClassname( {
		justify: props.justify || "start",
		align: props.align || "start",
		direction: props.direction || "row",
		wrap: props.wrap ? "true" : "false"
	} ), [ props.justify, props.align, props.direction, props.wrap ] );

	return <div className={ baseClassName + ` ${ props.className }` }>{ props.children }</div>;
}