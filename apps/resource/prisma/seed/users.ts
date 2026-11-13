/** Accounts created by the auth seed (apps/auth/prisma/seed.ts), so authors hydrate to real names. */
export const SEED_USERS = {
	admin: 'admin',
	minh: '8ac3508e-d8bc-425f-9b4d-04461d9bd0ec',
	linh: '4292d890-805f-4fca-b007-8ce887d87f3d',
	duc: 'f5553ed6-6eac-4be8-af62-fbb4226f2e9f',
	hoa: '2261ce28-2f42-4420-b5af-580f8d4b8abe',
	tuan: '3a2fbb54-984f-4318-bff0-218dc2a9f12c',
	mai: 'c14da81d-0fee-4520-b2ff-fe80141d786e',
	khoa: '0833eda1-18e0-4f74-b774-158cea662100',
	thao: 'ff8aafa4-7715-4806-9d29-a46807de020d',
	nam: '70b51742-b20a-43bf-9a5c-6d7c9aef7bba',
} as const;

/** Unsplash photos (free licence), served by their CDN; the Markdown renderer shows plain <img>. */
export const photo = (id: string, width = 1200): string =>
	`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;
