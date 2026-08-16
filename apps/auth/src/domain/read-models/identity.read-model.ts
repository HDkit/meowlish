export type IdentityReadModel = {
	id: string;
	username: string;
	fullName?: string;
	bio?: string;
	avatarUrl?: string;
	permissions: string[];
	roles: string[];
};

export type HydratedIdentityReadModel = Omit<IdentityReadModel, 'permissions' | 'roles'>;
