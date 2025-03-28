"use client";

import { Button } from "@/components/base/button";
import { LoginButton } from "@/components/main/login-button";
import { ThemeSwitcher } from "@/components/main/theme-switcher";
import type { Auth } from "@/types/auth";
import { cn } from "@/utils/cn";
import { fjalla } from "@/utils/fonts";
import { CogIcon, HomeIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function Navbar( props: { authInfo?: Auth.Info | null } ) {
	const router = useRouter();
	const pathname = usePathname();
	const page = pathname.split( "/" )[ 1 ];

	const randomBg = () => {
		const bgs = [ "bg-main", "bg-bg" ];
		return bgs[ Math.floor( Math.random() * 2 ) ];
	};

	return (
		<div
			className={ cn(
				"flex flex-col items-center justify-between",
				"fixed z-20 bg-white left-0 right-0"
			) }
		>
			<div
				className={ cn(
					"flex gap-1 lg:gap-2 justify-center items-center font-bold",
					"w-full py-5 px-3 md:px-5 border-b-4"
				) }
			>
				{ "stairway".split( "" ).map( ( letter, index ) => (
					<div
						key={ index }
						className={
							cn(
								"text-xl w-9 h-9 flex items-center justify-center",
								"md:text-2xl md:w-12 md:h-12",
								"lg:text-3xl lg:w-16 lg:h-16 lg:border-4",
								"xl:text-5xl xl:w-20 xl:h-20",
								"border-gray-800 border-2 rounded-md",
								fjalla.className,
								randomBg()
							)
						}
					>
						{ letter.toUpperCase() }
					</div>
				) ) }
			</div>
			<div className={ "flex bg-bg w-full px-3 md:px-5 py-3 md:py-5 justify-between border-b-2" }>
				<div className={ "flex gap-3" }>
					<Button
						className={ cn( page === "" && "bg-white", "w-8 h-8" ) }
						onClick={ () => router.push( "/" ) }
						size={ "icon" }
					>
						<HomeIcon className={ "w-4 h-4" }/>
					</Button>
					<Button
						className={ cn( page === "settings" && "bg-white", "w-8 h-8" ) }
						onClick={ () => router.push( "/settings" ) }
						size={ "icon" }
					>
						<CogIcon className={ "w-4 h-4" }/>
					</Button>
				</div>
				<div className={ "flex gap-3" }>
					<ThemeSwitcher/>
					{ !props.authInfo && <LoginButton/> }
				</div>
			</div>
		</div>
	);
}