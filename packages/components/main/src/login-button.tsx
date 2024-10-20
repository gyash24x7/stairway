import { EnterIcon } from "@radix-ui/react-icons";
import { Button } from "@stairway/components/base";
import { Fragment } from "react";

export function LoginButton() {
	return (
		<a href={ "/auth/login" }>
			<Button className={ "flex gap-2 items-center w-full mb-4" }>
				<Fragment>LOGIN</Fragment>
				<EnterIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
			</Button>
		</a>
	);
}