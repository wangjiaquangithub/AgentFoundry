import type { RefObject } from 'react';
import { useRef } from 'react';

function scrollToSection(ref: RefObject<HTMLElement | HTMLDivElement | null>) {
	ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function usePlatformPageRefs() {
	const membersRef = useRef<HTMLElement | null>(null);
	const agentManagementRef = useRef<HTMLElement | null>(null);
	const agentRunnerRef = useRef<HTMLElement | null>(null);
	const connectorCenterRef = useRef<HTMLElement | null>(null);
	const governanceRef = useRef<HTMLElement | null>(null);
	const workflowRunnerRef = useRef<HTMLElement | null>(null);
	const toolRunnerRef = useRef<HTMLElement | null>(null);
	const memoryOperationsRef = useRef<HTMLElement | null>(null);
	const configManagementRef = useRef<HTMLElement | null>(null);
	const agentTemplateStepRef = useRef<HTMLDivElement | null>(null);
	const agentModelStepRef = useRef<HTMLDivElement | null>(null);
	const agentKnowledgeStepRef = useRef<HTMLDivElement | null>(null);
	const agentToolsStepRef = useRef<HTMLDivElement | null>(null);
	const agentRuntimeStepRef = useRef<HTMLDivElement | null>(null);

	return {
		membersRef,
		agentManagementRef,
		agentRunnerRef,
		connectorCenterRef,
		governanceRef,
		workflowRunnerRef,
		toolRunnerRef,
		memoryOperationsRef,
		configManagementRef,
		agentTemplateStepRef,
		agentModelStepRef,
		agentKnowledgeStepRef,
		agentToolsStepRef,
		agentRuntimeStepRef,
		scrollToAgentManagement: () => scrollToSection(agentManagementRef),
		scrollToMembers: () => scrollToSection(membersRef),
		scrollToAgentRunner: () => scrollToSection(agentRunnerRef),
		scrollToConnectorCenter: () => scrollToSection(connectorCenterRef),
		scrollToGovernance: () => scrollToSection(governanceRef),
		scrollToWorkflowRunner: () => scrollToSection(workflowRunnerRef),
		scrollToToolRunner: () => scrollToSection(toolRunnerRef),
		scrollToMemoryOperations: () => scrollToSection(memoryOperationsRef),
		scrollToConfigManagement: () => scrollToSection(configManagementRef),
	};
}
