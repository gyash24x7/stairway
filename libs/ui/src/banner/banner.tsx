import type { Appearance, IconType } from "../utils/types";
import { Spinner } from "../spinner/spinner";
import { HStack } from "../stack/h-stack";
import { VariantSchema } from "../utils/variant";
import React from "react";

export interface BannerProps {
    className?: string;
    appearance?: Appearance;
    icon?: IconType;
    message: string;
    isLoading?: boolean;
    centered?: boolean;
}

const bannerVariantSchema = new VariantSchema(
    "p-4 rounded-md border font-semibold",
    {
        appearance: {
            default: "bg-light border-light-700 text-dark",
            primary: "bg-primary border-primary-700 text-light",
            warning: "bg-warning border-warning-700 text-dark",
            success: "bg-success border-success-700 text-light",
            danger: "bg-danger border-danger-700 text-light",
            alt: "bg-alt border-alt-700 text-light",
            info: "bg-info border-info-700 text-light"
        }
    },
    { appearance: "primary" }
);

export function Banner( props: BannerProps ) {
    const { appearance = "default", isLoading, icon: Icon, message, centered = false, className } = props;
    return (
        <div className = { `${ bannerVariantSchema.getClassname( { appearance } ) } ${ className }` }>
            <HStack centered = { centered }>
                { isLoading && (
                    <Spinner
                        data-testid = { "banner-spinner" }
                        size = { "sm" }
                        appearance = { appearance === "warning" || appearance === "default"
                            ? "dark"
                            : "default" }
                    />
                ) }
                { !!Icon &&
                    !isLoading &&
					<Icon width = { 20 } height = { 20 } data-testid = { "banner-icon" } /> }
                <h2 data-testid = { "banner-message" }>{ message }</h2>
            </HStack>
        </div>
    );
}