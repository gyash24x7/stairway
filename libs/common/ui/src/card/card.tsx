import { ReactNode, useMemo } from "react";
import { When } from "react-if";
import { VariantSchema } from "../utils/index.js";

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
	const titleClass = useMemo( () => cardTitleVariantSchema.getClassname( {
		centered: centered ? "true" : "false"
	} ), [ centered ] );

	return (
		<div className={ "rounded-md p-4 flex-1 bg-light-100" }>
			<When condition={ !!title }>
				<h2 className={ titleClass }>{ title }</h2>
			</When>
			{ content }
		</div>
	);
}