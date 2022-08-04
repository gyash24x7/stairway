import React from "react";
import { Avatar, HStack } from "@s2h/ui";
import { useAuth } from "../utils/auth";


export function UserCard() {
	const { user } = useAuth();

	return (
		<div className = { "bg-light-100 rounded-md p-5 w-full mb-4" }>
			<HStack centered>
				<Avatar name = { user?.name } src = { user?.avatar }/>
				<div>
					<p className = { "text-base" }>{ user?.name?.toUpperCase() }</p>
					<p className = { "text-sm text-dark-100" }>{ user?.email?.toLowerCase() }</p>
				</div>
			</HStack>
		</div>
	);
}