import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../button/index.js";
import { TextInput } from "../input/index.js";
import { Form, FormProps } from "./form.js";

interface DemoFormData {
	name: string;
	email: string;
}

const meta: Meta<FormProps<DemoFormData>> = {
	title: "Form",
	component: Form
};

export default meta;

export const Playground: StoryObj<FormProps<DemoFormData>> = {
	render: ( args ) => <Form { ...args } />,
	args: {
		initialValue: { name: "", email: "" },
		submitBtn: () => <Button buttonText={ "Submit" }/>,
		renderMap: {
			name: props => <TextInput{ ...props } label={ "Name" } placeholder={ "Enter Name" }/>,
			email: props => <TextInput { ...props } type={ "email" } label={ "Email" } placeholder={ "Enter Email" }/>
		}
	}
};