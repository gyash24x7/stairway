import { useMemo } from "react";
import { Else, If, Then, When } from "react-if";
import type { Appearance, RenderIcon, Size } from "../utils/index.js";
import { VariantSchema } from "../utils/index.js";
import { Spinner } from "../spinner/index.js";

export interface ButtonProps {
	disabled?: boolean;
	type?: "submit" | "reset";
	onClick?: () => any | Promise<any>;

	size?: Size;
	fullWidth?: boolean;
	appearance?: Appearance;

	buttonText?: string;
	isLoading?: boolean;
	renderIconBefore?: RenderIcon;
	renderIconAfter?: RenderIcon;
}

function renderButtonIcon( renderIcon?: RenderIcon, size: Size = "md" ) {
	if ( !renderIcon ) {
		return;
	}

	const sizeMap = {
		xs: { width: 10, height: 10 },
		sm: { width: 12, height: 12 },
		md: { width: 14, height: 14 },
		lg: { width: 16, height: 16 },
		xl: { width: 20, height: 20 },
		"2xl": { width: 24, height: 24 }
	};
	const { width, height } = sizeMap[ size ];
	return renderIcon( { width, height, className: "mx-4" } );
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
	const spinnerAppearance = useMemo( () => {
		return props.appearance === "warning" || props.appearance === "default" ? "dark" : "default";
	}, [ props.appearance ] );

	const buttonClassname = useMemo( () => buttonVariantSchema.getClassname( {
		appearance: props.appearance,
		size: props.size,
		fullWidth: props.fullWidth ? "true" : "false",
		disabled: props.disabled || props.isLoading ? "true" : "false"
	} ), [ props.appearance, props.size, props.fullWidth, props.disabled ] );

	return (
		<button
			disabled={ props.disabled || props.isLoading }
			onClick={ props.onClick }
			type={ props.type }
			className={ buttonClassname }
		>
			<If condition={ !props.isLoading }>
				<Then>
					<When condition={ !!props.renderIconBefore }>
						{ renderButtonIcon( props.renderIconBefore, props.size ) }
					</When>
					<When condition={ !!props.buttonText }>
						<span>{ props.buttonText }</span>
					</When>
					<When condition={ !!props.renderIconAfter }>
						{ renderButtonIcon( props.renderIconAfter, props.size ) }
					</When>
				</Then>
				<Else>
					<Spinner size={ props.size } appearance={ spinnerAppearance }/>
				</Else>
			</If>
		</button>
	);
}