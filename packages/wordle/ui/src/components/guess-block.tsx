import type { PositionData } from "@common/words";
import { Box, Flex } from "@mantine/core";
import { guessBlockClassnames } from "../styles/components.css";

export function GuessBlocks( props: { guessBlocks: PositionData[][] } ) {

	return props.guessBlocks.map( ( guessBlock, i ) => (
		<Flex gap={ "md" } key={ i }>
			<Flex gap={ "md" } flex={ 1 }>
				{ guessBlock.map( ( { letter, state }, index ) => (
					<Box className={ guessBlockClassnames.guessLetter( { state } ) } fz={ 32 } key={ index }>
						{ letter }
					</Box>
				) ) }
			</Flex>
		</Flex>
	) );
}

export function GuessDiagramBlocks( props: { guessBlocks: PositionData[][] } ) {
	return props.guessBlocks.map( ( guessBlock, i ) => (
		<Flex gap={ "xs" } key={ i }>
			{ guessBlock.map( ( { state }, index ) => (
				<Box className={ guessBlockClassnames.guessLetterDiagram( { state } ) } key={ index }/>
			) ) }
		</Flex>
	) );
}
