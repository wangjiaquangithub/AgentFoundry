import type {
	EnterprisePlatformMember,
	EnterprisePlatformMemberUpsertRequest,
} from '@/api';
import type { MemberFormState } from './platform-defaults';

export type MemberStatusToggleAction =
	| {
			kind: 'activate';
			userId: string;
			patch: Pick<EnterprisePlatformMemberUpsertRequest, 'status'>;
	  }
	| {
			kind: 'deactivate';
			userId: string;
	  };

export type MemberEditActionHandlers = {
	setMemberForm: (form: MemberFormState) => void;
};

export function memberUserIdFromForm(form: MemberFormState): string {
	return form.user_id.trim();
}

export function memberCreatePayloadFromForm(
	form: MemberFormState,
	userId: string,
): EnterprisePlatformMemberUpsertRequest {
	return {
		user_id: userId,
		tenant: form.tenant.trim() || 'default',
		display_name: form.display_name.trim() || userId,
		role: form.role.trim() || 'Member',
		status: form.status,
	};
}

export function memberFormFromMember(
	member: EnterprisePlatformMember,
): MemberFormState {
	return {
		user_id: member.user_id,
		tenant: member.tenant || 'acme',
		display_name: member.display_name || member.user_id,
		role: member.role || '',
		status: member.status === 'inactive' ? 'inactive' : 'active',
	};
}

export function runMemberEditAction(
	member: EnterprisePlatformMember,
	handlers: MemberEditActionHandlers,
) {
	handlers.setMemberForm(memberFormFromMember(member));
}

export function memberStatusToggleAction(
	member: EnterprisePlatformMember,
): MemberStatusToggleAction {
	if (member.status === 'inactive') {
		return {
			kind: 'activate',
			userId: member.user_id,
			patch: { status: 'active' },
		};
	}

	return {
		kind: 'deactivate',
		userId: member.user_id,
	};
}
