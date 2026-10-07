import { useState } from "react";

import type { User } from "@/auth/schema";
import { LogoutButton } from "@/auth/ui/logout-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/primitives/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/shared/primitives/dialog";


export function RUser( { user }: { user: User } ) {
	const [ open, setOpen ] = useState( false );
	const initials = user.name.split( " " )
		.map( ( n: string ) => n[ 0 ] )
		.join( "" )
		.toUpperCase();

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger>
				<Avatar className="h-10 w-10 cursor-pointer">
					<AvatarImage
						src={ user.avatar }
						alt={ user.name }
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
								src={ user.avatar }
								alt={ user.name }
								className={ "bg-background" }
							/>
							<AvatarFallback>{ initials }</AvatarFallback>
						</Avatar>
					</div>
					<div className={ "flex-1 px-4 py-2 flex flex-col justify-between" }>
						<div>
							<h2 className="text-2xl font-semibold mb-1 text-foreground">
								{ user.name }
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
