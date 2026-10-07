import { cn } from "cn";
import { HomeIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/shared/primitives/button";
import { Separator } from "@/shared/primitives/separator";
import { Logo } from "@/shared/shell/logo";
import { ThemeSwitcher } from "@/shared/shell/theme-switcher";


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
					<Button size={ "icon" } onClick={ () => navigate( "/" ) }>
						<HomeIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					</Button>
					<Button
						size={ "icon" }
						onClick={ () => navigate( "/tables" ) }
						title={ "Open tables" }
					>
						<UsersIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					</Button>
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					{ props.children }
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					<ThemeSwitcher/>
				</div>
			</div>
		</div>
	);
}
