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
	// const router = useRouter();
	// const pathname = usePathname();
	const page = "pathname".split( "/" )[ 1 ];

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
					<a href={ links( "/" ) }>
						<Button
							className={ cn( page === "" && "bg-white", "w-8 h-8 md:w-10 md:h-10" ) }
							size={ "icon" }
						>
							<HomeIcon className={ "w-4 h-4" }/>
						</Button>
					</a>
					<a href={ links( "/settings" ) }>
						<Button
							className={ cn( page === "settings" && "bg-white", "w-8 h-8 md:w-10 md:h-10" ) }
							size={ "icon" }
						>
							<CogIcon className={ "w-4 h-4" }/>
						</Button>
					</a>
				</div>
				<div className={ "flex gap-3" }>
					<ThemeSwitcher/>
					{ !props.authInfo && <Login/> }
				</div>
			</div>
		</div>
	);
}