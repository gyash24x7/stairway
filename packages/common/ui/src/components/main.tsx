import { AppShell } from "@mantine/core";
import type { ReactNode } from "react";
import classnames from "../styles/components.module.css";

export function AppMain( props: { children: ReactNode } ) {
	return <AppShell.Main className={ classnames[ "layoutMain" ] }>{ props.children }</AppShell.Main>;
}