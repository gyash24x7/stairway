import type { ReactNode } from "react";
import { authLayoutClassnames as classnames } from "../styles";
import { Flex, Paper } from "@mantine/core";

export function AuthLayout( props: { children: ReactNode } ) {
	return (
		<Flex className={ classnames.wrapper } direction={ "row-reverse" }>
			<Paper className={ classnames.form } radius={ 0 } p={ 30 }>
				<img src={ "logo.png" } alt={ "logo" } className={ classnames.logo }/>
				{ props.children }
			</Paper>
		</Flex>
	);
}