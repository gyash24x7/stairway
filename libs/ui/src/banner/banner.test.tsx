import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Banner } from "@s2h/ui";
import { CheckIcon } from "@heroicons/react/solid";

describe( "Banner Component", function () {

    it( "should render banner with icon when not in loading state", function () {
        render( <Banner message = { "Banner Message" } icon = { CheckIcon } /> );

        const msgElement = screen.queryByTestId( "banner-message" );
        const iconElement = screen.queryByTestId( "banner-icon" );
        const spinnerElement = screen.queryByTestId( "banner-spinner" );

        expect( spinnerElement ).toBeNull();
        expect( iconElement ).toBeTruthy();
        expect( msgElement ).toBeTruthy();
        expect( msgElement?.textContent ).toBe( "Banner Message" );
    } );

    it( "should render banner without icon when in loading state", function () {
        render(
            <Banner
                message = { "Banner Message" }
                icon = { CheckIcon }
                isLoading = { true }
                appearance = { "primary" }
            />
        );

        const msgElement = screen.queryByTestId( "banner-message" );
        const iconElement = screen.queryByTestId( "banner-icon" );

        expect( iconElement ).toBeNull();
        expect( msgElement ).toBeTruthy();
        expect( msgElement?.textContent ).toBe( "Banner Message" );
    } );

    it( "should render banner correctly", function () {
        render( <Banner message = { "Banner Message" } isLoading = { true } /> );

        const msgElement = screen.queryByTestId( "banner-message" );
        const iconElement = screen.queryByTestId( "banner-icon" );

        expect( iconElement ).toBeNull();
        expect( msgElement ).toBeTruthy();
        expect( msgElement?.textContent ).toBe( "Banner Message" );
    } );

} );