import { useNavigate } from "@tanstack/react-router";
import { HomeIcon } from "lucide-react";

import type { ReactNode } from "react";

import { InstallButton } from "@/pwa/client/install-button.tsx";
import { Logo } from "@/shared/ui/components/logo.tsx";
import { ThemeSwitcher } from "@/shared/ui/components/theme-switcher.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Separator } from "@/shared/ui/primitives/separator.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

export function Navbar( props: { children: ReactNode } ) {
	const navigate = useNavigate();
	return (
		<div
			className={ cn(
				"border-b-2 border-outline fixed z-1 left-0 right-0",
				"bg-background px-2 md:px-4 py-1 md:py-2 flex justify-center"
			) }
		>
			<div className={ "flex justify-between items-center w-full max-w-4xl" }>
				<div className={ "flex gap-2 items-center" }>
					<Logo url={ "/stairway.svg" } classname={ "w-12 h-12 bg-accent" }/>
					<h2 className={ "text-4xl font-title text-accent hidden md:block" }>
						STAIRWAY
					</h2>
				</div>
				<div className={ "flex flex-1 justify-end gap-3 items-center" }>
					<Button size={ "icon" } onClick={ () => navigate( { to: "/" } ) }>
						<HomeIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					</Button>
					{ /* Renders nothing once installed, or where install is impossible. */ }
					<InstallButton/>
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					{ props.children }
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					<ThemeSwitcher/>
				</div>
			</div>
		</div>
	);
}
