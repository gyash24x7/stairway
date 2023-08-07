import { CheckIcon } from "@heroicons/react/24/solid";
import { Button } from "./button.js";
import { cleanup, render } from "@testing-library/react";

import { afterEach, describe, expect, it } from "vitest";

describe( "Button Component", () => {

	it( "should render button text correctly", () => {
		const { queryByTestId } = render( <Button
			buttonText={ "Button Text" }
			appearance={ "warning" }
		/> );

		const buttonTextSpan = queryByTestId( "button-text" );
		expect( buttonTextSpan ).toBeTruthy();
		expect( buttonTextSpan?.textContent ).toBe( "Button Text" );
	} );

	it( "should render button text and icons correctly", () => {
		const { queryByTestId } = render(
			<Button
				buttonText={ "Button Text" }
				renderIconAfter={ () => <CheckIcon width={ 4 } height={ 4 }/> }
				renderIconBefore={ () => <CheckIcon width={ 4 } height={ 4 }/> }
			/>
		);

		const buttonTextSpan = queryByTestId( "button-text" );
		expect( buttonTextSpan ).toBeTruthy();
		expect( buttonTextSpan?.textContent ).toBe( "Button Text" );

		const buttonContent = buttonTextSpan?.parentElement?.parentElement;
		expect( buttonContent ).toBeTruthy();
		expect( buttonContent?.children.length ).toBe( 3 );
	} );

	it(
		"should not render button text when in loading state but render spinner with disabled button",
		() => {
			const { queryByTestId } = render( <Button buttonText={ "Button Text" } isLoading fullWidth/> );

			const buttonTextSpan = queryByTestId( "button-text" );
			expect( buttonTextSpan ).toBeFalsy();

			const mainButton = queryByTestId( "button-main" ) as unknown as HTMLButtonElement;
			expect( mainButton ).toBeTruthy();
			expect( mainButton.disabled ).toBeTruthy();
			expect( mainButton.children.length ).toBe( 1 );
		}
	);

	afterEach( () => {
		cleanup();
	} );

} );