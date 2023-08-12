import { useMemo } from "react";
import { Else, If, Then } from "react-if";
import type { Appearance, RenderIcon } from "../utils/index.js";
import { VariantSchema } from "../utils/index.js";
import { HStack } from "../stack/index.js";
import { Spinner } from "../spinner/index.js";

export interface BannerProps {
	className?: string;
	appearance?: Appearance;
	renderIcon?: RenderIcon;
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
	const { appearance = "default", isLoading, renderIcon, message, centered = false, className } = props;

	const bannerClassname = useMemo( () => {
		return `${ bannerVariantSchema.getClassname( { appearance } ) } ${ className }`;
	}, [ appearance, className ] );

	const spinnerAppearance = useMemo( () => {
		return appearance === "warning" || appearance === "default" ? "dark" : "default";
	}, [ appearance ] );

	return (
		<div className={ bannerClassname }>
			<HStack centered={ centered } spacing={ "sm" }>
				<If condition={ isLoading }>
					<Then>
						<Spinner size={ "sm" } appearance={ spinnerAppearance }/>
					</Then>
					<Else>
						<If condition={ !!renderIcon && !isLoading }>
							<Then>{ renderIcon && renderIcon() }</Then>
						</If>
					</Else>
				</If>
				<h2>{ message }</h2>
			</HStack>
		</div>
	);
}