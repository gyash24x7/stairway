import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { Fragment, useState } from "react";
import { Else, If, Then } from "react-if";
import { Button } from "../button/index.js";
import { HStack } from "../stack/index.js";

export interface StepperStep {
	name: string;
	content: JSX.Element;
}

export interface StepperProps {
	steps: StepperStep[];
	onEnd: () => void | Promise<void>;
	isLoading?: boolean;
}

interface StepperButtonProps {
	onClick: () => void | Promise<void>;
	isLoading?: boolean;
}

const PreviousButton = ( props: StepperButtonProps & { disabled?: boolean } ) => (
	<Button
		renderIconBefore={ props => <ArrowLeftIcon { ...props }/> }
		size={ "sm" }
		appearance={ "default" }
		{ ...props }
	/>
);

const NextButton = ( props: StepperButtonProps ) => (
	<Button
		renderIconAfter={ props => <ArrowRightIcon { ...props } /> }
		size={ "sm" }
		appearance={ "primary" }
		{ ...props }
	/>
);

const EndButton = ( props: StepperButtonProps ) => (
	<Button buttonText={ "Submit" } size={ "sm" } appearance={ "primary" } { ...props } />
);

export function Stepper( props: StepperProps ) {
	const stepMap: Record<string, JSX.Element> = {};
	const stepNames: string[] = [];

	props.steps.forEach( step => {
		stepMap[ step.name ] = step.content;
		stepNames.push( step.name );
	} );

	const [ activeStep, setActiveStep ] = useState( stepNames[ 0 ] );

	const handlePrevious = () => {
		for ( let i = 1; i < stepNames.length; i++ ) {
			const stepName = stepNames[ i ];
			if ( stepName === activeStep ) {
				setActiveStep( stepNames[ i - 1 ] );
				break;
			}
		}
	};

	const handleNext = () => {
		for ( let i = 0; i < stepNames.length - 1; i++ ) {
			const stepName = stepNames[ i ];
			if ( stepName === activeStep ) {
				setActiveStep( stepNames[ i + 1 ] );
				break;
			}
		}
	};

	return (
		<Fragment>
			{ stepMap[ activeStep ] }
			<If condition={ activeStep === stepNames[ stepNames.length - 1 ] }>
				<Then>
					<HStack className={ "mt-6" } spacing={ "sm" }>
						<PreviousButton onClick={ handlePrevious }/>
						<EndButton onClick={ props.onEnd } isLoading={ props.isLoading }/>
					</HStack>
				</Then>
				<Else>
					<HStack className={ "mt-6" } spacing={ "sm" }>
						<PreviousButton onClick={ handlePrevious } disabled={ stepNames[ 0 ] === activeStep }/>
						<NextButton onClick={ handleNext }/>
					</HStack>
				</Else>
			</If>
		</Fragment>
	);
}