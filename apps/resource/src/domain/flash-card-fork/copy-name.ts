/**
 * The name for a copy: the original's, or "<name> (bản sao)", "<name> (bản sao 2)", … when the
 * user already has a list with that name.
 */
export const copyName = (name: string, takenNames: ReadonlySet<string>): string => {
	if (!takenNames.has(name)) return name;
	for (let n = 1; ; n++) {
		const candidate = n === 1 ? `${name} (bản sao)` : `${name} (bản sao ${n})`;
		if (!takenNames.has(candidate)) return candidate;
	}
};
