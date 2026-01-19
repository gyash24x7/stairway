import { useAuth } from "@s2h-ui/auth/context";
import { DisplayAuthInfo } from "@s2h-ui/auth/display-auth-info";
import { Login } from "@s2h-ui/auth/login";
import { Button } from "@s2h-ui/primitives/button";
import { HomeIcon } from "@s2h-ui/primitives/icons";
import { Separator } from "@s2h-ui/primitives/separator";
import { cn } from "@s2h-ui/primitives/utils";
import { useNavigate } from "@tanstack/react-router";
import { ThemeSwitcher } from "./theme-switcher.tsx";

export function Navbar() {
	const navigate = useNavigate();
	const { isLoggedIn } = useAuth();
	return (
		<div
			className={
				cn(
					"border-b-2 border-gray-400 fixed z-20 left-0 right-0",
					"bg-background px-2 md:px-4 py-1 md:py-2"
				) }
		>
			<div className={ "flex justify-between items-center w-full max-w-4xl justify-self-center" }>
				<div className={ "flex gap-2 items-center" }>
					<img src={ "/s2h.png" } alt={ "logo" } className={ "h-12 md:h-16" }/>
					<h2 className={ "text-5xl font-heading text-neutral-dark hidden md:block" }>
						STAIRWAY
					</h2>
				</div>
				<div className={ "flex flex-1 justify-end gap-3 items-center" }>
					<Button size={ "icon" } onClick={ () => navigate( { to: "/" } ) }>
						<HomeIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					</Button>
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					{ isLoggedIn ? <DisplayAuthInfo/> : <Login/> }
					<Separator orientation={ "vertical" } className={ "h-12" }/>
					<ThemeSwitcher/>
				</div>
			</div>
		</div>
	);
}