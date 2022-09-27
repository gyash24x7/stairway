import type { Meta, Story } from "@storybook/react";
import { TextInput, TextInputProps } from "./text-input";
import type { Appearance } from "../utils/types";
import { LockClosedIcon, MailIcon } from "@heroicons/react/solid";
import React from "react";

export default {
    component: TextInput,
    title: "TextInput",
    argTypes: {
        appearance: {
            options: [ "default", "danger", "success" ] as Appearance[],
            control: { type: "inline-radio" },
            defaultValue: "neutral",
            description: "Sets the appearance of the Input"
        }
    }
} as Meta<TextInputProps>;

const Template: Story<TextInputProps> = args => <TextInput { ...args } />;

export const Playground = Template.bind( {} );
Playground.args = {
    name: "firstName",
    message: "Helper Text",
    label: "Name",
    placeholder: "Enter your Name",
    appearance: "default"
} as TextInputProps;

export const TextInputWithIconBefore = Template.bind( {} );
TextInputWithIconBefore.args = {
    name: "email",
    label: "Email",
    type: "email",
    placeholder: "Enter your Email",
    appearance: "default",
    iconBefore: MailIcon
} as TextInputProps;

export const TextInputWithIconAfter = Template.bind( {} );
TextInputWithIconAfter.args = {
    name: "password",
    label: "Password",
    type: "password",
    placeholder: "Enter your Password",
    appearance: "default",
    iconAfter: LockClosedIcon
} as TextInputProps;
