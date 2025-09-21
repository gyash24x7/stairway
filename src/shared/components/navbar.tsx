"use client";

import { Login } from "@/auth/components/login";
import type { AuthInfo } from "@/auth/types";
import { ThemeSwitcher } from "@/shared/components/theme-switcher";
import { Button } from "@/shared/primitives/button";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@/shared/utils/cn";
import { useNavigate } from "@tanstack/react-router";
import { CogIcon, HomeIcon } from "lucide-react";

export function Navbar( props: { authInfo?: AuthInfo | null } ) {
	const navigate = useNavigate();
	return (
		<div
			className={ "flex bg-white w-full px-2 md:px-4 py-1 md:py-2 justify-between items-center border-b-4 fixed z-20 left-0 right-0" }>
			<div className={ "flex gap-2 items-center bg-main p-1 md:px-2 border-border rounded border-4" }>
				<img src={ "/s2h.png" } alt={ "logo" } className={ "h-12 md:h-16" }/>
				<h2 className={ "text-5xl font-heading text-main-foreground hidden md:block" }>STAIRWAY</h2>
			</div>
			<div className={ "flex flex-1 justify-end gap-3 items-center" }>
				<Button
					className={ cn( "w-8 h-8 md:w-10 md:h-10" ) }
					size={ "icon" }
					onClick={ () => navigate( { to: "/" } ) }
				>
					<HomeIcon className={ "w-4 h-4" }/>
				</Button>
				<Button
					className={ cn( "w-8 h-8 md:w-10 md:h-10" ) }
					size={ "icon" }
					onClick={ () => navigate( { to: "/settings" } ) }
				>
					<CogIcon className={ "w-4 h-4" }/>
				</Button>
				<Separator orientation={ "vertical" } className={ "h-12" }/>
				<ThemeSwitcher/>
				{ !props.authInfo && <Login/> }
			</div>
		</div>
	);
}