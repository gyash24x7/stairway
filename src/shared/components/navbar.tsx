import { RAuthInfo } from "@/auth/components/auth-info";
import { useAuth } from "@/auth/components/context";
import { Login } from "@/auth/components/login";
import { ThemeSwitcher } from "@/shared/components/theme-switcher";
import { Button } from "@/shared/primitives/button";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@/shared/utils/cn";
import { useNavigate } from "@tanstack/react-router";
import { HomeIcon } from "lucide-react";

export function Navbar() {
	const navigate = useNavigate();
	const { authInfo } = useAuth();
	return (
		<div
			className={ cn(
				"border-b-2 border-gray-400 fixed z-1 left-0 right-0",
				"bg-background px-2 md:px-4 py-1 md:py-2"
			) }
		>
			<div className={ "flex justify-between items-center w-full max-w-4xl justify-self-center" }>
				<div className={ "flex gap-2 items-center" }>
					<img src={ "/s2h.png" } alt={ "logo" } className={ "h-12 md:h-16" }/>
					<h2 className={ "text-5xl font-title text-accent hidden md:block" }>
						STAIRWAY
					</h2>
				</div>
				<div className={ "flex flex-1 justify-end gap-3 items-center" }>
					<Button size={ "icon" } onClick={ () => navigate( { to: "/" } ) }>
						<HomeIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					</Button>
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					{ !!authInfo ? <RAuthInfo authInfo={ authInfo }/> : <Login/> }
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					<ThemeSwitcher/>
				</div>
			</div>
		</div>
	);
}