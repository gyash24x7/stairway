import { Fragment } from "react";
import { InputMessage } from "./input-message";
import { VariantSchema } from "../utils/variant";

export interface TextAreaProps {
	label?: string;
	name: string;
	placeholder?: string;
	message?: string;
	rows?: number;
	value?: string;
	onChange?: ( value: string ) => void | Promise<void>;
	appearance?: "default" | "danger" | "success";
}

const inputRootVS = new VariantSchema(
	"flex items-center border-2 rounded-md border-light-700 text-dark w-full p-2 text-base",
	{
		valid: { true: "border-success", false: "" },
		invalid: { true: "border-danger", false: "" }
	},
	{ valid: "false", invalid: "false" }
);

export function TextArea( props: TextAreaProps ) {
	const inputRootClassname = inputRootVS.getClassname( {
		valid: props.appearance === "success" ? "true" : "false",
		invalid: props.appearance === "danger" ? "true" : "false"
	} );

	return (
		<Fragment>
			{ props.label && <label className = { "label-root" } htmlFor = { props.name }>{ props.label }</label> }
			<div className = { inputRootClassname }>
				<textarea
					name = { props.name }
					rows = { props.rows || 3 }
					placeholder = { props.placeholder || "" }
					value = { props.value }
					onChange = { e => props.onChange && props.onChange( e.target.value ) }
				/>
			</div>
			{ props.message && <InputMessage text = { props.message } appearance = { props.appearance }/> }
		</Fragment>
	);
}