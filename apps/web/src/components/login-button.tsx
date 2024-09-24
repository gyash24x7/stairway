import { Button } from "@base/components";
import { EnterIcon } from "@radix-ui/react-icons";
import { Fragment } from "react";

const LOGIN_URL = process.env.NODE_ENV === "development"
	? "http://localhost:8000/api/auth/login"
	: "/api/auth/login";

export function LoginButton() {
	return (
		<a href={ LOGIN_URL }>
			<Button className={ "flex gap-2 items-center w-full mb-4" }>
				<Fragment>LOGIN</Fragment>
				<EnterIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
			</Button>
		</a>
	);
}