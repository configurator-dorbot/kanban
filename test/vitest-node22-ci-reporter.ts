import { logActiveResources, shouldLogNode22CiDiagnostics } from "./vitest-node22-ci-diagnostics.js";

const HEARTBEAT_INTERVAL_MS = 30_000;

interface ReporterTestModuleLike {
	moduleId: string;
}

interface ReporterTestCaseLike {
	fullName: string;
}

let reporterInitialized = false;
let didReachTestRunEnd = false;
let didReachFinished = false;
let startedAt = 0;
let lastQueuedModule = "";
let lastStartedModule = "";
let lastReadyTestCase = "";

function elapsedMs(): number {
	return startedAt === 0 ? 0 : Date.now() - startedAt;
}

function startHeartbeatTimer(): void {
	const timer = setInterval(() => {
		logActiveResources(
			`heartbeat elapsedMs=${String(elapsedMs())} reachedTestRunEnd=${String(didReachTestRunEnd)} reachedFinished=${String(didReachFinished)} lastQueuedModule=${lastQueuedModule || "<none>"} lastStartedModule=${lastStartedModule || "<none>"} lastReadyTestCase=${lastReadyTestCase || "<none>"}`,
		);
	}, HEARTBEAT_INTERVAL_MS);
	timer.unref?.();
}

export default {
	onInit() {
		if (!shouldLogNode22CiDiagnostics() || reporterInitialized) {
			return;
		}
		reporterInitialized = true;
		startedAt = Date.now();
		logActiveResources("reporter onInit");
		startHeartbeatTimer();
	},
	onTestRunEnd() {
		if (!shouldLogNode22CiDiagnostics()) {
			return;
		}
		didReachTestRunEnd = true;
		logActiveResources(`reporter onTestRunEnd elapsedMs=${String(elapsedMs())}`);
	},
	onFinished() {
		if (!shouldLogNode22CiDiagnostics()) {
			return;
		}
		didReachFinished = true;
		logActiveResources(`reporter onFinished elapsedMs=${String(elapsedMs())}`);
	},
	onTestModuleQueued(testModule: ReporterTestModuleLike) {
		if (!shouldLogNode22CiDiagnostics()) {
			return;
		}
		lastQueuedModule = testModule.moduleId;
	},
	onTestModuleStart(testModule: ReporterTestModuleLike) {
		if (!shouldLogNode22CiDiagnostics()) {
			return;
		}
		lastStartedModule = testModule.moduleId;
	},
	onTestCaseReady(testCase: ReporterTestCaseLike) {
		if (!shouldLogNode22CiDiagnostics()) {
			return;
		}
		lastReadyTestCase = testCase.fullName;
	},
	onProcessTimeout() {
		if (!shouldLogNode22CiDiagnostics()) {
			return;
		}
		logActiveResources(
			`reporter onProcessTimeout elapsedMs=${String(elapsedMs())} reachedTestRunEnd=${String(didReachTestRunEnd)} reachedFinished=${String(didReachFinished)} lastQueuedModule=${lastQueuedModule || "<none>"} lastStartedModule=${lastStartedModule || "<none>"} lastReadyTestCase=${lastReadyTestCase || "<none>"}`,
		);
	},
};
