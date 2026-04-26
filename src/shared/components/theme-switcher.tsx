"use client";

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
import { updateTheme } from "@/shared/utils/theme";
import { MoonIcon, SunIcon } from "lucide-react";
import { Fragment, useEffect, useState, useTransition } from "react";

type ThemeSwitcherProps = {
	initialTheme: Theme;
	initialThemeMode: ThemeMode;
}

export function ThemeSwitcher( { initialTheme, initialThemeMode }: ThemeSwitcherProps ) {
	const [ theme, setTheme ] = useState<Theme>( initialTheme );
	const [ themeMode, setThemeMode ] = useState<ThemeMode>( initialThemeMode );
	const [ isPending, startTransition ] = useTransition();

	const handleThemeChange = ( theme: Theme, mode: ThemeMode ) => startTransition( async () => {
		await updateTheme( theme, mode );
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
			<Select
				onValueChange={ ( t ) => handleThemeChange( t ?? "apple", themeMode ) }
				value={ theme }
			>
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
				onClick={ () => handleThemeChange(
					theme,
					themeMode === "light" ? "dark" : "light"
				) }
			>
				{ themeMode === "light"
					? <SunIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					: <MoonIcon className={ "w-4 h-4 md:h-6 md:w-6" }/> }
			</Button>
		</Fragment>
	);
}