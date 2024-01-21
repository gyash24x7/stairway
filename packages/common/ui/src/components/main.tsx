import { AppShell } from "@mantine/core";
import type { ReactNode } from "react";
import { layoutClassnames as classnames } from "../styles/components.css";

export function AppMain( props: { children: ReactNode } ) {
	return <AppShell.Main className={ classnames.main }>{ props.children }</AppShell.Main>;
}