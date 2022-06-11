import type { ComponentProps } from "react";

export type IconType = ( props: ComponentProps<"svg"> ) => JSX.Element;

export type Appearance = "primary" | "default" | "warning" | "danger" | "success" | "info" | "alt"

export type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
