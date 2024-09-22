import { Button, Spinner } from "@base/components";
import { EnterIcon, ExitIcon, HomeIcon } from "@radix-ui/react-icons";
import { client, LOGIN_URL, type UserAuthInfo } from "@stairway/clients/auth";
import { useMutation } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { Fragment } from "react";

export const Navbar = ( { authInfo }: { authInfo?: UserAuthInfo } ) => {
	const router = useRouter();

	const { mutate, isPending } = useMutation( {
		mutationFn: () => client.logout(),
		onSuccess: () => router.invalidate()
	} );

	return (
		<div className="p-2 flex gap-3 text-lg flex-row-reverse items-center">
			{ !authInfo && (
				<a href={ LOGIN_URL }>
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