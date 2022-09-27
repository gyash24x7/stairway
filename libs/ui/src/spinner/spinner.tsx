import type { Appearance, Size } from "../utils/types";
import { VariantSchema } from "../utils/variant";
import React from "react";

export interface SpinnerProps {
    size?: Size;
    appearance?: Appearance | "dark";
}

const spinnerRootVS = new VariantSchema(
    "animate-spin",
    {
        size: {
            xs: "w-4 h-4",
            sm: "w-5 h-5",
            md: "w-6 h-6",
            lg: "w-8 h-8",
            xl: "w-10 h-10",
            "2xl": "w-14 h-14"
        }
    },
    { size: "md" }
);

const spinnerCircleVS = new VariantSchema(
    "animate-dash fill-transparent stroke-[5px]",
    {
        appearance: {
            default: "stroke-light",
            primary: "stroke-primary",
            warning: "stroke-warning",
            success: "stroke-success",
            alt: "stroke-alt",
            info: "stroke-info",
            danger: "stroke-danger",
            dark: "stroke-dark"
        }
    },
    { appearance: "default" }
);

export function Spinner( { appearance, size }: SpinnerProps ) {
    return (
        <svg viewBox = "0 0 50 50" className = { spinnerRootVS.getClassname( { size } ) }>
            <circle
                cx = { 25 }
                cy = { 25 }
                r = { 20 }
                className = { spinnerCircleVS.getClassname( { appearance } ) }
            />
        </svg>
    );
}