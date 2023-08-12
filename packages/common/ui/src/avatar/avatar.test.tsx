import { Avatar } from "./avatar.js";
import { cleanup, render, screen } from "@testing-library/react";

import { afterEach, describe, expect, it } from "vitest";

describe( "Avatar Component", () => {

	it( "should render avatar image", () => {
		render( <Avatar src={ "abcd.png" }/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		expect.assertions( 2 );

		if ( !!imageElement ) {
			expect( imageElement.getAttribute( "src" ) ).toBe( "abcd.png" );
			expect( screen.queryByTestId( "avatar-initials" ) ).toBeNull();
		}
	} );

	it( "should render initials when img not there", () => {
		render( <Avatar name={ "Yash Gupta" }/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		const initialsElement = screen.queryByTestId( "avatar-initials" );
		expect.assertions( 2 );

		if ( !!initialsElement ) {
			expect( initialsElement.textContent ).toBe( "YG" );
			expect( imageElement ).toBeNull();
		}
	} );

	it( "should render initials from first name when last name not there", () => {
		render( <Avatar name={ "Yash" }/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		const initialsElement = screen.queryByTestId( "avatar-initials" );
		expect.assertions( 2 );

		if ( !!initialsElement ) {
			expect( initialsElement.textContent ).toBe( "YA" );
			expect( imageElement ).toBeNull();
		}
	} );

	it( "should render initials from first name when last name not there", () => {
		render( <Avatar name={ "Y" }/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		const initialsElement = screen.queryByTestId( "avatar-initials" );
		expect.assertions( 3 );

		if ( !!initialsElement ) {
			expect( initialsElement.textContent?.length ).toBe( 2 );
			expect( initialsElement.textContent?.indexOf( "Y" ) ).toBe( 0 );
			expect( imageElement ).toBeNull();
		}
	} );

	it( "should render random initials when name not there", () => {
		render( <Avatar/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		const initialsElement = screen.queryByTestId( "avatar-initials" );
		expect.assertions( 2 );

		if ( !!initialsElement ) {
			expect( initialsElement.textContent?.length ).toBe( 2 );
			expect( imageElement ).toBeNull();
		}
	} );

	afterEach( async () => {
		cleanup();
	} );
} );