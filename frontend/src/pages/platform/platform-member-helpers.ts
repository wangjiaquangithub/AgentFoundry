import type {
	EnterprisePlatformMember,
	EnterprisePlatformMemberUpsertRequest,
} from '@/api';
import type { MemberFormState } from './platform-defaults';

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

export function memberShouldActivate(member: EnterprisePlatformMember) {
	return member.status === 'inactive';
}
