import { Route as RootRoute } from "@/routes/__root";
import { Button } from "@/shared/primitives/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger
} from "@/shared/primitives/select";
import { type Theme, type ThemeMode, themeModes, themes } from "@/shared/utils/cn";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { MoonIcon, SunIcon } from "lucide-react";
import { Fragment, useEffect, useState, useTransition } from "react";
import * as v from "valibot";

export const updateTheme = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		theme: v.picklist( themes ),
		themeMode: v.picklist( themeModes )
	} ) )
	.handler( async ( { data } ) => {
		setCookie( "theme", data.theme );
		setCookie( "themeMode", data.themeMode );
	} );


export const getTheme = createServerFn( { method: "GET" } )
	.handler( () => {
		const initialTheme = getCookie( "theme" ) as Theme | "";
		const initialThemeMode = getCookie( "themeMode" ) as ThemeMode | "";
		return {
			initialTheme: !initialTheme ? "apple" : initialTheme,
			initialThemeMode: !initialThemeMode ? "dark" : initialThemeMode
		};
	} );

export function ThemeSwitcher() {
	const { initialTheme, initialThemeMode } = RootRoute.useRouteContext();
	const [ theme, setTheme ] = useState<Theme>( initialTheme );
	const [ themeMode, setThemeMode ] = useState<ThemeMode>( initialThemeMode );
	const [ isPending, startTransition ] = useTransition();

	const handleThemeChange = async ( theme: Theme, mode: ThemeMode ) => startTransition( async () => {
		await updateTheme( { data: { themeMode: mode, theme } } );
		setTheme( theme );
		setThemeMode( mode );
	} );

	useEffect( () => {
		document.body.classList.remove( ...themes );
		document.body.classList.remove( ...themeModes );
		document.body.classList.add( theme, themeMode );
	}, [ theme, themeMode ] );

	return (
		<Fragment>
			<Select onValueChange={ ( t ) => handleThemeChange( t ?? "apple", themeMode ) } value={ theme }>
				<SelectTrigger disabled={ isPending }/>
				<SelectContent>
					<SelectGroup>
						{ themes.map( ( theme ) => (
							<Fragment key={ theme }>
								<SelectItem label={ theme.toUpperCase() } value={ theme }/>
								<SelectSeparator/>
							</Fragment>
						) ) }
					</SelectGroup>
				</SelectContent>
			</Select>
			<Button
				size={ "icon" }
				disabled={ isPending }
				onClick={ () => handleThemeChange( theme, themeMode === "light" ? "dark" : "light" ) }
			>
				{ themeMode === "light"
					? <SunIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					: <MoonIcon className={ "w-4 h-4 md:h-6 md:w-6" }/> }
			</Button>
		</Fragment>
	);
}