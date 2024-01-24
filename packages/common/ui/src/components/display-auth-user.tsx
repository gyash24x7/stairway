import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from "@clerk/clerk-react";
import { Avatar, Button, Group } from "@mantine/core";
import { Fragment } from "react";

export function DisplayAuthUser() {
	const { user } = useUser();
	return (
		<Fragment>
			<SignedIn>
				<Group>
					<SignOutButton>
						<Button color={ "danger" } fw={ 700 } size={ "sm" }>
							LOGOUT
						</Button>
					</SignOutButton>
					<Avatar src={ user?.imageUrl } size={ 48 } radius={ "50%" }/>
				</Group>
			</SignedIn>
			<SignedOut>
				<SignInButton>
					<Button fw={ 700 } size={ "sm" }>LOGIN</Button>
				</SignInButton>
			</SignedOut>
		</Fragment>
	);
}