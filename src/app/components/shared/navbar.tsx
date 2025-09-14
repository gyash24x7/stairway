"use client";

import { Login } from "@/app/components/auth/login";
import { ThemeSwitcher } from "@/app/components/shared/theme-switcher";
import { Button } from "@/app/primitives/button";
import { Separator } from "@/app/primitives/separator";
import { cn } from "@/utils/cn";
import type { AuthInfo } from "@/workers/auth/types";
import { CogIcon, HomeIcon } from "lucide-react";

export function Navbar( props: { authInfo?: AuthInfo | null } ) {
	return (
		<div
			className={ "flex bg-white w-full px-2 md:px-4 py-1 md:py-2 justify-between items-center border-b-4 fixed z-20 left-0 right-0" }>
			<div className={ "flex gap-2 items-center bg-main p-1 md:px-2 border-border rounded border-4" }>
				<img src={ "/s2h.png" } alt={ "logo" } className={ "h-12 md:h-16" }/>
				<h2 className={ "text-5xl font-heading text-main-foreground hidden md:block" }>STAIRWAY</h2>
			</div>
			<div className={ "flex flex-1 justify-end gap-3 items-center" }>
				<a href={ "/" }>
					<Button className={ cn( "w-8 h-8 md:w-10 md:h-10" ) } size={ "icon" }>
						<HomeIcon className={ "w-4 h-4" }/>
					</Button>
				</a>
				<a href={ "/settings" }>
					<Button className={ cn( "w-8 h-8 md:w-10 md:h-10" ) } size={ "icon" }>
						<CogIcon className={ "w-4 h-4" }/>
					</Button>
				</a>
				<Separator orientation={ "vertical" } className={ "h-12" }/>
				<ThemeSwitcher/>
				{ !props.authInfo && <Login/> }
			</div>
		</div>
	);
}