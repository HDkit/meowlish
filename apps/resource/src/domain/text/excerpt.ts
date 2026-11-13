/**
 * Plain-text preview of a Markdown body for list views: drops images, code fences, quote/heading/list
 * markers and emphasis, collapses whitespace, and cuts at a word boundary with an ellipsis.
 */
export const toExcerpt = (markdown: string, maxLength = 160): string => {
	const text = markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+\.)\s+/gm, '')
		.replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
		.replace(/[|*_~`]/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length <= maxLength) return text;
	const cut = text.slice(0, maxLength);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};
