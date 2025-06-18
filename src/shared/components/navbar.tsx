"use client";

import { Login } from "@/auth/components/login";
import type { AuthInfo } from "@/auth/types";
import { Logo } from "@/shared/components/logo";
import { ThemeSwitcher } from "@/shared/components/theme-switcher";
import { links } from "@/shared/links";
import { Button } from "@/shared/primitives/button";
import { cn } from "@/shared/utils/cn";
import { CogIcon, HomeIcon } from "lucide-react";

export function Navbar( props: { authInfo?: AuthInfo | null } ) {

	const navigate = ( link: string ) => () => {
		if ( window.location.pathname.split( "/" )[ 1 ] !== link.split( "/" )[ 1 ] ) {
			window.location.href = link;
		}
	};

	return (
		<div
			className={ cn(
				"flex flex-col items-center justify-between",
				"fixed z-20 bg-white left-0 right-0"
			) }
		>
			<Logo/>
			<div className={ "flex bg-bg w-full px-3 md:px-5 py-3 md:py-5 justify-between border-b-2" }>
				<div className={ "flex gap-3" }>
					<Button
						className={ cn( "w-8 h-8 md:w-10 md:h-10" ) }
						size={ "icon" }
						onClick={ navigate( links( "/" ) ) }
					>
						<HomeIcon className={ "w-4 h-4" }/>
					</Button>
					<Button
						className={ cn( "w-8 h-8 md:w-10 md:h-10" ) }
						size={ "icon" }
						onClick={ navigate( links( "/settings" ) ) }
					>
						<CogIcon className={ "w-4 h-4" }/>
					</Button>
				</div>
				<div className={ "flex gap-3" }>
					<ThemeSwitcher/>
					{ !props.authInfo && <Login/> }
				</div>
			</div>
		</div>
	);
}