export type IdentityReadModel = {
	id: string;
	username: string;
	fullName?: string;
	bio?: string;
	avatarUrl?: string;
	phoneNumber?: string;
	isLocked: boolean;
	permissions: string[];
	roles: string[];
};

export type HydratedIdentityReadModel = Omit<
	IdentityReadModel,
	'permissions' | 'isLocked'
> & {
	phoneNumber?: string;
};
