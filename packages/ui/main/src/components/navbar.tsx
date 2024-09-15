"use client";

import { UserAuthInfo } from "@auth/api";
import { Button, Spinner } from "@base/ui";
import { EnterIcon, ExitIcon, HomeIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Fragment } from "react";
import { useServerAction } from "zsa-react";
import { logout } from "../actions.ts";

export const Navbar = ( { authInfo }: { authInfo?: UserAuthInfo } ) => {
	const { isPending, execute } = useServerAction( logout );

	return (
		<div className="p-2 flex gap-3 text-lg flex-row-reverse items-center">
			{ !authInfo && (
				<a href={ "/auth/login" }>
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
					onClick={ () => execute() }
				>
					{ isPending
						? <Spinner/>
						: (
							<Fragment>
								<Fragment>LOGOUT</Fragment>
								<ExitIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
							</Fragment>
						)
					}
				</Button>
			) }
			<Link href="/apps/web/public">
				<Button variant={ "ghost" } className={ "font-bold flex gap-2 items-center" }>
					<HomeIcon className={ "w-4 h-4" }/>
					<Fragment>HOME</Fragment>
				</Button>
			</Link>
		</div>
	);
};