"use client";

import { LogoutButton } from "@/auth/components/logout-button";
import type { AuthInfo } from "@/auth/core/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/primitives/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/shared/primitives/dialog";
import { useState } from "react";

export function RAuthInfo( { authInfo }: { authInfo: AuthInfo } ) {
	const [ open, setOpen ] = useState( false );
	const initials = authInfo.name.split( " " )
		.map( ( n: string ) => n[ 0 ] )
		.join( "" )
		.toUpperCase();

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger>
				<Avatar className="h-10 w-10 cursor-pointer">
					<AvatarImage
						src={ authInfo.avatar }
						alt={ authInfo.name }
						className={ "bg-accent" }
					/>
					<AvatarFallback>{ initials }</AvatarFallback>
				</Avatar>
			</DialogTrigger>
			<DialogContent>
				<div className="flex w-full max-w-xl">
					<div className={ "bg-accent p-8 rounded-md" }>
						<Avatar className="h-24 w-24 border-none">
							<AvatarImage
								src={ authInfo.avatar }
								alt={ authInfo.name }
								className={ "bg-background" }
							/>
							<AvatarFallback>{ initials }</AvatarFallback>
						</Avatar>
					</div>
					<div className={ "flex-1 px-4 py-2 flex flex-col justify-between" }>
						<div>
							<h2 className="text-2xl font-semibold mb-1 text-foreground">
								{ authInfo.name }
							</h2>
							<h2 className="text-md mb-1 text-accent">
								@{ authInfo.username }
							</h2>
						</div>
						<div className={ "flex justify-end" }>
							<LogoutButton/>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}