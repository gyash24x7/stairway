import { Fragment, useMemo } from "react";
import { When } from "react-if";
import { VariantSchema } from "../utils/index.js";
import { InputMessage } from "./input-message.js";
import type { InputProps } from "./text-input.js";

export interface TextAreaProps extends InputProps {
	label?: string;
	placeholder?: string;
	message?: string;
	rows?: number;
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
	const inputRootClassname = useMemo( () => inputRootVS.getClassname( {
		valid: props.appearance === "success" ? "true" : "false",
		invalid: props.appearance === "danger" ? "true" : "false"
	} ), [ props.appearance ] );

	return (
		<Fragment>
			<When condition={ !!props.label }>
				<label className={ "text-sm text-dark-100 font-semibold" } htmlFor={ props.name.toString() }>
					{ props.label }
				</label>
			</When>
			<div className={ inputRootClassname }>
			<textarea
				name={ props.name.toString() }
				rows={ props.rows || 3 }
				placeholder={ props.placeholder || "" }
				value={ props.value || "" }
				onInput={ e => props.setValue && props.setValue( e.currentTarget.value ) }
				style={ { all: "unset", width: "100%" } }
			/>
			</div>
			<When condition={ !!props.message }>
				<InputMessage text={ props.message! } appearance={ props.appearance }/>
			</When>
		</Fragment>
	);
}