import { MoonIcon, SunIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger
} from "@/shared/ui/primitives/select.tsx";
import { themes } from "@/shared/ui/utils/cn.ts";
import { applyTheme, readTheme } from "@/shared/ui/utils/theme.ts";

import type { Theme, ThemeMode } from "@/shared/ui/utils/cn.ts";

export function ThemeSwitcher() {
	const [ { theme, mode }, setState ] = useState( () => readTheme() );

	const handleThemeChange = ( nextTheme: Theme, nextMode: ThemeMode ) => {
		applyTheme( nextTheme, nextMode );
		setState( { theme: nextTheme, mode: nextMode } );
	};

	return (
		<Fragment>
			<Select
				onValueChange={ ( t ) => handleThemeChange( ( t as Theme ) ?? "apple", mode ) }
				value={ theme }
			>
				<SelectTrigger/>
				<SelectContent>
					<SelectGroup>
						{ themes.map( ( t ) => (
							<Fragment key={ t }>
								<SelectItem label={ t.toUpperCase() } value={ t }/>
								<SelectSeparator/>
							</Fragment>
						) ) }
					</SelectGroup>
				</SelectContent>
			</Select>
			<Button
				size={ "icon" }
				onClick={ () => handleThemeChange( theme, mode === "light" ? "dark" : "light" ) }
			>
				{ mode === "light"
					? <SunIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					: <MoonIcon className={ "w-4 h-4 md:h-6 md:w-6" }/> }
			</Button>
		</Fragment>
	);
}
