import { RAuthInfo } from "@s2h/ui/auth/auth-info";
import { Login } from "@s2h/ui/auth/login";
import { Logo } from "@s2h/ui/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useAuth } from "@s2h/ui/hooks/use-auth";
import { Button } from "@s2h/ui/primitives/button";
import { Separator } from "@s2h/ui/primitives/separator";
import { cn } from "@s2h/shared/utils/cn";
import { useNavigate } from "@tanstack/react-router";
import { HomeIcon } from "lucide-react";

export function Navbar() {
	const navigate = useNavigate();
	const { authInfo } = useAuth();

	return (
		<div
			className={ cn(
				"border-b-2 border-inverted-surface fixed z-1 left-0 right-0",
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
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					{ !!authInfo ? <RAuthInfo authInfo={ authInfo }/> : <Login/> }
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					<ThemeSwitcher/>
				</div>
			</div>
		</div>
	);
}
