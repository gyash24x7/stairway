export type Appearance = "primary" | "default" | "warning" | "danger" | "success" | "info" | "alt"

export type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

export type RenderIconProps = {
	width?: number;
	height?: number;
	className?: string;
}

export type RenderIcon = ( props?: RenderIconProps ) => JSX.Element;