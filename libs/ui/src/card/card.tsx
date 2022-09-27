import type { ReactNode } from "react";
import React from "react";
import { VariantSchema } from "../utils/variant";

export interface CardProps {
    title?: string;
    content: ReactNode;
    centered?: boolean;
}

const cardTitleVariantSchema = new VariantSchema(
    "text-xl mb-2 font-semibold",
    { centered: { true: "text-center", false: "" } },
    { centered: "false" }
);

export function Card( { centered, title, content }: CardProps ) {
    return (
        <div className = { "rounded-md p-4 flex-1 bg-light-100" }>
            { !!title && (
                <h2
                    className = { cardTitleVariantSchema.getClassname( {
                        centered: centered
                            ? "true"
                            : "false"
                    } ) }
                >
                    { title }
                </h2>
            ) }
            { content }
        </div>
    );
}