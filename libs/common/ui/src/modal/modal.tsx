import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useMemo } from "react";
import { When } from "react-if";
import { VariantSchema } from "../utils/index.js";

export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children?: JSX.Element;
}

export function ModalTitle( props: { title: string } ) {
	return (
		<Dialog.Title as="h3" className={ "text-xl font-semibold leading-6 mb-4" }>
			{ props.title }
		</Dialog.Title>
	);
}

const modalBodyVS = new VariantSchema(
	"text-base",
	{ withTitle: { true: "mt-4", false: "" } },
	{ withTitle: "false" }
);

export function Modal( { isOpen, onClose, children, title }: ModalProps ) {
	const modalBodyClassname = useMemo( () => {
		return modalBodyVS.getClassname( { withTitle: !!title ? "true" : "false" } );
	}, [ title ] );

	return (
		<Transition appear show={ isOpen } as={ Fragment }>
			<Dialog className={ "relative z-10" } onClose={ onClose }>
				<Transition.Child
					as={ Fragment }
					enter="ease-out duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-200"
					leaveFrom="opacity-100"
					leaveTo="opacity-0"
				>
					<div className={ "fixed inset-0 bg-dark-700/50" }/>
				</Transition.Child>
				<div className="fixed inset-0 overflow-y-auto">
					<div className="flex min-h-full items-center justify-center p-4 text-center">
						<Transition.Child
							as={ Fragment }
							enter="ease-out duration-300"
							enterFrom="opacity-0 scale-90"
							enterTo="opacity-100 scale-100"
							leave="ease-in duration-200"
							leaveFrom="opacity-100 scale-100"
							leaveTo="opacity-0 scale-90"
						>
							<Dialog.Panel
								className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
								<When condition={ !!title }>
									<ModalTitle title={ title! }/>
								</When>
								<When condition={ !!children }>
									<div className={ modalBodyClassname }>
										<Dialog.Description>
											{ children }
										</Dialog.Description>
									</div>
								</When>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</div>
			</Dialog>
		</Transition>
	);
}