import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { Fragment, ReactNode, useState } from "react";
import { Button } from "../button/button";
import { HStack } from "../stack/h-stack";

export interface StepperStep {
	name: string;
	content: ReactNode;
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
	<Button iconBefore={ ArrowLeftIcon } size={ "sm" } appearance={ "default" } { ...props } />
);

const NextButton = ( props: StepperButtonProps ) => (
	<Button iconAfter={ ArrowRightIcon } size={ "sm" } appearance={ "primary" } { ...props } />
);

const EndButton = ( props: StepperButtonProps ) => (
	<Button buttonText={ "Submit" } size={ "sm" } appearance={ "primary" } { ...props } />
);

export function Stepper( props: StepperProps ) {
	const stepMap: Record<string, ReactNode> = {};
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
			{ activeStep === stepNames[ stepNames.length - 1 ] ? (
				<HStack className={ "mt-6" } spacing={ "sm" }>
					<PreviousButton onClick={ handlePrevious }/>
					<EndButton onClick={ props.onEnd } isLoading={ props.isLoading }/>
				</HStack>
			) : (
				<HStack className={ "mt-6" } spacing={ "sm" }>
					<PreviousButton
						onClick={ handlePrevious }
						disabled={ stepNames[ 0 ] === activeStep }
					/>
					<NextButton onClick={ handleNext }/>
				</HStack>
			) }
		</Fragment>
	);
}