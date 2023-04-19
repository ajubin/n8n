import { Container } from 'typedi';
import { RoleRepository, UserRepository } from '@db/repositories';
import type { Role } from '@db/entities/Role';
import type { User } from '@db/entities/User';

export function isInstanceOwner(user: User): boolean {
	return user.globalRole.name === 'owner';
}

export async function getWorkflowOwnerRole(): Promise<Role> {
	return Container.get(RoleRepository).findWorkflowOwnerRoleOrFail();
}

export async function getUserIdByEmail(email: string): Promise<User['id'] | undefined> {
	return Container.get(UserRepository)
		.findOne({ select: ['id'], where: { email } })
		.then((u) => u?.id);
}
