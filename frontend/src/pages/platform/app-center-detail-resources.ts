import { Boxes, Brain, KeyRound, LibraryBig, UserRound } from 'lucide-react';

import type { AppCenterResource } from './components/AppCenterPanel';
import { resourceCountLabel, resourceListLabel } from './platform-utils';

export function agentAppCenterDetailResources(
	values: {
		model: string;
		knowledge: string[];
		tools: string[];
		runtime: string;
		access: string;
	},
	labels: {
		model: string;
		knowledgeBases: string;
		tools: string;
		runtime: string;
		access: string;
		none: string;
	},
): AppCenterResource[] {
	return [
		{
			label: labels.model,
			value: values.model,
			icon: KeyRound,
		},
		{
			label: labels.knowledgeBases,
			value: resourceListLabel(values.knowledge, labels.none),
			icon: LibraryBig,
		},
		{
			label: labels.tools,
			value: resourceListLabel(values.tools, labels.none),
			icon: Boxes,
		},
		{
			label: labels.runtime,
			value: values.runtime,
			icon: Brain,
		},
		{
			label: labels.access,
			value: values.access,
			icon: UserRound,
		},
	];
}

export function templateAppCenterDetailResources(
	values: {
		modelCount: number;
		knowledgeBaseCount: number;
		tools: string[];
	},
	labels: {
		model: string;
		availableModels: (count: number) => string;
		noModel: string;
		knowledgeBases: string;
		availableKnowledgeBases: (count: number) => string;
		tools: string;
		runtime: string;
		templateRuntime: string;
		none: string;
	},
): AppCenterResource[] {
	return [
		{
			label: labels.model,
			value: resourceCountLabel(values.modelCount, {
				available: labels.availableModels,
				empty: labels.noModel,
			}),
			icon: KeyRound,
		},
		{
			label: labels.knowledgeBases,
			value: resourceCountLabel(values.knowledgeBaseCount, {
				available: labels.availableKnowledgeBases,
				empty: labels.none,
			}),
			icon: LibraryBig,
		},
		{
			label: labels.tools,
			value: resourceListLabel(values.tools, labels.none),
			icon: Boxes,
		},
		{
			label: labels.runtime,
			value: labels.templateRuntime,
			icon: Brain,
		},
	];
}
