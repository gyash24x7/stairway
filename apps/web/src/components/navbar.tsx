import { UserAuthInfo } from "@auth/api";
import { Button, Spinner } from "@base/ui";
import { EnterIcon, ExitIcon, HomeIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { Fragment } from "react";

const logout = async () => {
	await fetch(
		"http://localhost:8000/api/auth/logout",
		{ method: "DELETE", credentials: "include" }
	).then( res => res.json() );
};

export const Navbar = ( { authInfo }: { authInfo?: UserAuthInfo } ) => {
	const router = useRouter();

	const { mutate, isPending } = useMutation( {
		mutationFn: () => logout(),
		onSuccess: () => router.invalidate()
	} );

	return (
		<div className="p-2 flex gap-3 text-lg flex-row-reverse items-center">
			{ !authInfo && (
				<a href={ "http://localhost:8000/api/auth/login" }>
					<Button variant={ "ghost" } className={ "font-bold flex gap-2 items-center" }>
						<Fragment>LOGIN</Fragment>
						<EnterIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
					</Button>
				</a>
			) }
			{ !!authInfo && (
				<Button
					variant={ "ghost" }
					className={ "text-red-500 font-bold flex gap-2 items-center" }
					onClick={ () => mutate() }
				>
					{ isPending ? <Spinner/> : (
						<Fragment>
							<Fragment>LOGOUT</Fragment>
							<ExitIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
						</Fragment>
					) }
				</Button>
			) }
			<Link to={ "/" }>
				<Button variant={ "ghost" } className={ "font-bold flex gap-2 items-center" }>
					<HomeIcon className={ "w-4 h-4" }/>
					<Fragment>HOME</Fragment>
				</Button>
			</Link>
		</div>
	);
};