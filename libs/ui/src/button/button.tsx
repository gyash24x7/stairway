import type { Appearance, IconType, Size } from "../utils/types";
import { Spinner } from "../spinner/spinner";
import { HStack } from "../stack/h-stack";
import { VariantSchema } from "../utils/variant";
import React from "react";

export interface ButtonProps {
    disabled?: boolean;
    type?: "submit" | "reset";
    onClick?: () => any | Promise<any>;

    size?: Size;
    fullWidth?: boolean;
    appearance?: Appearance;

    buttonText?: string;
    isLoading?: boolean;
    iconBefore?: IconType;
    iconAfter?: IconType;
}

function renderButtonIcon( Icon: IconType, size: Size = "md" ) {
    const sizeMap = {
        xs: { width: 10, height: 10 },
        sm: { width: 12, height: 12 },
        md: { width: 14, height: 14 },
        lg: { width: 16, height: 16 },
        xl: { width: 20, height: 20 },
        "2xl": { width: 24, height: 24 }
    };
    const { width, height } = sizeMap[ size ];
    return <Icon width = { width } height = { height } />;
}

const buttonVariantSchema = new VariantSchema(
    "font-semibold rounded-md cursor-pointer focus:outline-none flex justify-center items-center font-sans",
    {
        appearance: {
            default: "bg-light-400 hover:bg-light-500 text-dark",
            primary: "bg-primary hover:bg-primary-500 text-light",
            warning: "bg-warning hover:bg-warning-500 text-dark",
            success: "bg-success hover:bg-success-500 text-light",
            alt: "bg-alt hover:bg-alt-500 text-light",
            info: "bg-info hover:bg-info-500 text-light",
            danger: "bg-danger hover:bg-danger-500 text-light"
        },
        size: {
            xs: "h-6 px-4 text-xs",
            sm: "h-8 px-6 text-sm",
            md: "h-10 px-8 text-base",
            lg: "h-12 px-10 text-lg",
            xl: "h-16 px-12 text-xl",
            "2xl": "h-20 px-14 text-2xl"
        },
        fullWidth: {
            true: "w-full",
            false: ""
        },
        disabled: {
            true: "pointer-events-none cursor-default text-dark-200",
            false: ""
        }
    },
    { appearance: "default", size: "md", fullWidth: "false", disabled: "false" }
);

export function Button( props: ButtonProps ) {
    const spinnerAppearance = [ "warning", "default" ].includes( props.appearance || "" )
        ? "dark"
        : "default";
    return (
        <button
            disabled = { props.disabled || props.isLoading }
            onClick = { props.onClick }
            type = { props.type }
            className = { buttonVariantSchema.getClassname( {
                appearance: props.appearance,
                size: props.size,
                fullWidth: props.fullWidth ? "true" : "false",
                disabled: props.disabled || props.isLoading ? "true" : "false"
            } ) }
            data-testid = { "button-main" }
        >
            { !!props.isLoading && <Spinner size = { props.size } appearance = { spinnerAppearance } /> }
            { !props.isLoading && (
                <HStack spacing = { "sm" }>
                    { props.iconBefore && renderButtonIcon( props.iconBefore, props.size ) }
                    { props.buttonText && <span data-testid = { "button-text" }>{ props.buttonText }</span> }
                    { props.iconAfter && renderButtonIcon( props.iconAfter, props.size ) }
                </HStack>
            ) }
        </button>
    );
}