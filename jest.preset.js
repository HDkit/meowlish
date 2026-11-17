const nxPreset = require('@nx/jest/preset').default;

// Tests often run on the host that also serves the app stack. Without a cap, every Jest run starts
// one worker per core and Nx runs several projects at once (nx.json `parallel`), which can take the
// whole machine. JEST_MAX_WORKERS overrides the share (a number or a percentage of the cores).
module.exports = {
	...nxPreset,
	maxWorkers: process.env.JEST_MAX_WORKERS || '25%',
	// ts-jest workers grow with every file they compile; recycle one once it holds this much.
	workerIdleMemoryLimit: '512MB',
};
