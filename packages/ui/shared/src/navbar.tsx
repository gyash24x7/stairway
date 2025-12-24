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
					"justify-between items-center border-b-4 fixed z-20 left-0 right-0",
					"flex bg-background w-full px-2 md:px-4 py-1 md:py-2"
				) }
		>
			<div className={ "flex gap-2 items-center bg-accent p-1 md:px-2 border-black rounded border-4" }>
				<img src={ "/s2h.png" } alt={ "logo" } className={ "h-12 md:h-16" }/>
				<h2 className={ "text-5xl font-heading text-neutral-dark hidden md:block" }>STAIRWAY</h2>
			</div>
			<div className={ "flex flex-1 justify-end gap-3 items-center" }>
				<Button
					className={ cn( "w-8 h-8 md:w-10 md:h-10" ) }
					size={ "icon" }
					onClick={ () => navigate( { to: "/" } ) }
				>
					<HomeIcon className={ "w-4 h-4" }/>
				</Button>
				<Separator orientation={ "vertical" } className={ "h-12" }/>
				{ isLoggedIn ? <DisplayAuthInfo/> : <Login/> }
				<Separator orientation={ "vertical" } className={ "h-12" }/>
				<ThemeSwitcher/>
			</div>
		</div>
	);
}