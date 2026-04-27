"use client";

import { RAuthInfo } from "@/auth/components/auth-info";
import { Login } from "@/auth/components/login";
import type { AuthInfo } from "@/auth/core/types";
import { Logo } from "@/shared/components/logo";
import { ThemeSwitcher } from "@/shared/components/theme-switcher";
import { Button } from "@/shared/primitives/button";
import { Separator } from "@/shared/primitives/separator";
import type { Theme, ThemeMode } from "@/shared/utils/cn";
import { cn } from "@/shared/utils/cn";
import { HomeIcon } from "lucide-react";
import { navigate } from "rwsdk/client";

type NavbarProps = {
	initialTheme: Theme;
	initialThemeMode: ThemeMode;
	authInfo: AuthInfo | null;
}

export function Navbar( { authInfo, ...props }: NavbarProps ) {
	return (
		<div
			className={ cn(
				"border-b-2 border-inverted-surface fixed z-1 left-0 right-0",
				"bg-background px-2 md:px-4 py-1 md:py-2"
			) }
		>
			<div
				className={ cn(
					"flex justify-between items-center w-full",
					"max-w-4xl justify-self-center"
				) }
			>
				<div className={ "flex gap-2 items-center" }>
					<Logo url={ "/stairway.svg" } classname={ "w-12 h-12 bg-accent" }/>
					<h2 className={ "text-4xl font-title text-accent hidden md:block" }>
						STAIRWAY
					</h2>
				</div>
				<div className={ "flex flex-1 justify-end gap-3 items-center" }>
					<Button size={ "icon" } onClick={ () => navigate( "/" ) }>
						<HomeIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					</Button>
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					{ !!authInfo ? <RAuthInfo authInfo={ authInfo }/> : <Login/> }
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					<ThemeSwitcher { ...props }/>
				</div>
			</div>
		</div>
	);
}