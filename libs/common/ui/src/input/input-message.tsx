import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import { Then, When } from "react-if";
import { VariantSchema } from "../utils/index.js";

export interface InputMessageProps {
	appearance?: "default" | "danger" | "success";
	text: string;
}

const inputMessageVS = new VariantSchema(
	"text-sm mt-1 flex items-center",
	{
		valid: { true: "text-success", false: "" },
		invalid: { true: "text-danger", false: "" }
	},
	{ valid: "false", invalid: "false" }
);

export function InputMessage( { appearance, text }: InputMessageProps ) {

	const inputMsgClassname = useMemo( () => inputMessageVS.getClassname( {
		valid: appearance === "success" ? "true" : "false",
		invalid: appearance === "danger" ? "true" : "false"
	} ), [ appearance ] );

	return (
		<div className={ inputMsgClassname }>
			<When condition={ appearance === "success" || appearance === "danger" }>
				<span className={ "inline-block mr-1" }>
					<When condition={ appearance === "success" }>
						<Then>
							<CheckCircleIcon className={ "w-3 h-3" }/>
						</Then>
					</When>
					<When condition={ appearance === "danger" }>
						<Then>
							<ExclamationCircleIcon className={ "w-3 h-3" }/>
						</Then>
					</When>
				</span>
			</When>
			<span>{ text }</span>
		</div>
	);
}