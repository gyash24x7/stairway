import { Flex, Paper } from "@mantine/core";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsLoggedIn } from "../store";
import { publicLayoutClassnames as classnames } from "../styles";

export function PublicLayout( props: { children: ReactNode } ) {
	const isLoggedIn = useIsLoggedIn();

	if ( isLoggedIn ) {
		return <Navigate to={ "/" }/>;
	}

	return (
		<Flex className={ classnames.wrapper } direction={ "row-reverse" }>
			<Paper className={ classnames.form } radius={ 0 } p={ 30 }>
				<img src={ "logo.png" } alt={ "logo" } className={ classnames.logo }/>
				{ props.children }
			</Paper>
		</Flex>
	);
}