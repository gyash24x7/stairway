import type { IconType } from "../utils/types";
import React, { Fragment } from "react";
import { InputMessage } from "./input-message";
import { VariantSchema } from "../utils/variant";

export interface TextInputProps {
	label?: string;
	name: string;
	placeholder?: string;
	message?: string;
	type?: "text" | "number" | "email" | "password";
	iconBefore?: IconType;
	iconAfter?: IconType;
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

export function TextInput( props: TextInputProps ) {
	const { iconAfter: IconAfter, iconBefore: IconBefore } = props;
	const inputRootClassname = inputRootVS.getClassname( {
		valid: props.appearance === "success" ? "true" : "false",
		invalid: props.appearance === "danger" ? "true" : "false"
	} );

	return (
		<Fragment>
			{ props.label && (
				<label className = { "text-sm text-dark-100 font-semibold" } htmlFor = { props.name }>
					{ props.label }
				</label>
			) }
			<div className = { inputRootClassname }>
				{ IconBefore!! && <IconBefore className = { "w-4 h-4 mr-3 text-light-700" }/> }
				<input
					style = { { all: "unset", flex: 1 } }
					type = { props.type || "text" }
					name = { props.name }
					placeholder = { props.placeholder }
					value = { props.value }
					onChange = { ( e: any ) => props.onChange && props.onChange( e.target.value ) }
				/>
				{ IconAfter!! && <IconAfter className = { "w-4 h-4 ml-3 text-light-700" }/> }
			</div>
			{ props.message && <InputMessage text = { props.message } appearance = { props.appearance }/> }
		</Fragment>
	);
}