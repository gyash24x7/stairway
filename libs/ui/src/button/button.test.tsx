import { render } from "@testing-library/react";
import { Button } from "@s2h/ui";
import React from "react";
import { CheckIcon } from "@heroicons/react/solid";

describe( "Button Component", function () {

    it( "should render button text correctly", function () {
        const { queryByTestId } = render( <Button
            buttonText = { "Button Text" }
            appearance = { "warning" }
        /> );

        const buttonTextSpan = queryByTestId( "button-text" );
        expect( buttonTextSpan ).toBeTruthy();
        expect( buttonTextSpan?.textContent ).toBe( "Button Text" );
    } );

    it( "should render button text and icons correctly", function () {
        const { queryByTestId } = render(
            <Button buttonText = { "Button Text" } iconAfter = { CheckIcon } iconBefore = { CheckIcon } />
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
        function () {
            const { queryByTestId } = render( <Button buttonText = { "Button Text" } isLoading fullWidth /> );

            const buttonTextSpan = queryByTestId( "button-text" );
            expect( buttonTextSpan ).toBeFalsy();

            const mainButton = queryByTestId( "button-main" ) as unknown as HTMLButtonElement;
            expect( mainButton ).toBeTruthy();
            expect( mainButton.disabled ).toBeTruthy();
            expect( mainButton.children.length ).toBe( 1 );
        }
    );

} );