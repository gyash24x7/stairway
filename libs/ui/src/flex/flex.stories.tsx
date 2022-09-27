import type { Meta, Story } from "@storybook/react";
import { Flex, FlexProps } from "./flex";
import React from "react";

export default {
    component: Flex,
    subcomponents: {},
    title: "Flex",
    argTypes: {
        direction: {
            description: "Sets the axis of flex",
            options: [ "row", "col", "col-reverse", "row-reverse" ],
            control: { type: "inline-radio" },
            defaultValue: "row"
        },
        justify: {
            description: "Sets the distribution of child elements on the flex axis",
            options: [ "start", "end", "center", "space-between", "space-around", "space-evenly" ],
            control: { type: "inline-radio" },
            defaultValue: "start"
        },
        align: {
            description: "Sets the distribution of child elements perpendicular to the flex axis",
            options: [ "start", "end", "center", "baseline", "stretch" ],
            control: { type: "inline-radio" },
            defaultValue: "start"
        }
    }
} as Meta<FlexProps>;

const Template: Story<FlexProps> = ( args ) => (
    <Flex { ...args }>
        <div style = { { background: "#dfe1e6", padding: 20 } }>Flex Child 1</div>
        <div style = { { background: "#c1c7d0", padding: 20 } }>Flex Child 2</div>
        <div style = { { background: "#808080", padding: 20 } }>Flex Child 3</div>
    </Flex>
);

export const Playground = Template.bind( {} );
Playground.args = { direction: "row", align: "start", justify: "start" } as FlexProps;