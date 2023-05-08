import { CheckIcon } from "@heroicons/react/24/solid";
import { Banner } from "@s2h/ui";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

describe( "Banner Component", function () {

	it( "should render banner with icon when not in loading state", function () {
		render( <Banner message={ "Banner Message" } icon={ CheckIcon }/> );

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
				message={ "Banner Message" }
				icon={ CheckIcon }
				isLoading={ true }
				appearance={ "primary" }
			/>
		);

		const msgElement = screen.queryByTestId( "banner-message" );
		const iconElement = screen.queryByTestId( "banner-icon" );

		expect( iconElement ).toBeNull();
		expect( msgElement ).toBeTruthy();
		expect( msgElement?.textContent ).toBe( "Banner Message" );
	} );

	it( "should render banner correctly", function () {
		render( <Banner message={ "Banner Message" } isLoading={ true }/> );

		const msgElement = screen.queryByTestId( "banner-message" );
		const iconElement = screen.queryByTestId( "banner-icon" );

		expect( iconElement ).toBeNull();
		expect( msgElement ).toBeTruthy();
		expect( msgElement?.textContent ).toBe( "Banner Message" );
	} );

	afterEach( () => {
		cleanup();
	} );

} );