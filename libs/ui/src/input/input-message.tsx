import React, { Fragment } from "react";
import { VariantSchema } from "../utils/variant";
import { HStack } from "../stack/h-stack";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/solid";

export interface InputMessageProps {
    appearance?: "default" | "danger" | "success";
    text: string;
}

const inputMessageVS = new VariantSchema(
    "text-sm text-dark-100 mt-1",
    {
        valid: { true: "text-success", false: "" },
        invalid: { true: "text-danger", false: "" }
    },
    { valid: "false", invalid: "false" }
);

export function InputMessage( { appearance, text }: InputMessageProps ) {
    let Icon: typeof CheckCircleIcon | undefined = undefined;
    if ( appearance === "success" ) {
        Icon = CheckCircleIcon;
    }
    if ( appearance === "danger" ) {
        Icon = ExclamationCircleIcon;
    }

    const inputMsgClassname = inputMessageVS.getClassname( {
        valid: appearance === "success" ? "true" : "false",
        invalid: appearance === "danger" ? "true" : "false"
    } );

    return (
        <div className = { inputMsgClassname }>
            <HStack spacing = { "xs" }>
                { Icon && <Icon className = { "w-3 h-3" } /> }
                <Fragment>{ text }</Fragment>
            </HStack>
        </div>
    );
}