import { Avatar } from "@s2h/ui";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

describe( "Avatar Component", function () {

	it( "should render avatar image", function () {
		render( <Avatar src={ "abcd.png" }/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		expect.assertions( 2 );

		if ( !!imageElement ) {
			expect( imageElement.getAttribute( "src" ) ).toBe( "abcd.png" );
			expect( screen.queryByTestId( "avatar-initials" ) ).toBeNull();
		}
	} );

	it( "should render initials when img not there", function () {
		render( <Avatar name={ "Yash Gupta" }/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		const initialsElement = screen.queryByTestId( "avatar-initials" );
		expect.assertions( 2 );

		if ( !!initialsElement ) {
			expect( initialsElement.textContent ).toBe( "YG" );
			expect( imageElement ).toBeNull();
		}
	} );

	it( "should render initials from first name when last name not there", function () {
		render( <Avatar name={ "Yash" }/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		const initialsElement = screen.queryByTestId( "avatar-initials" );
		expect.assertions( 2 );

		if ( !!initialsElement ) {
			expect( initialsElement.textContent ).toBe( "YA" );
			expect( imageElement ).toBeNull();
		}
	} );

	it( "should render initials from first name when last name not there", function () {
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

	it( "should render random initials when name not there", function () {
		render( <Avatar/> );

		const imageElement = screen.queryByAltText( "avatar-img" );
		const initialsElement = screen.queryByTestId( "avatar-initials" );
		expect.assertions( 2 );

		if ( !!initialsElement ) {
			expect( initialsElement.textContent?.length ).toBe( 2 );
			expect( imageElement ).toBeNull();
		}
	} );

} );