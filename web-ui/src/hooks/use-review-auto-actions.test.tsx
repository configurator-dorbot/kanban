import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskGitAction } from "@/git-actions/build-task-git-action-prompt";
import { useReviewAutoActions } from "@/hooks/use-review-auto-actions";
import { resetWorkspaceMetadataStore, setTaskWorkspaceSnapshot } from "@/stores/workspace-metadata-store";
import type { BoardColumnId, BoardData, ReviewTaskWorkspaceSnapshot } from "@/types";

function createBoard(
	autoReviewEnabled: boolean,
	autoReviewMode: "commit" | "pr" | "move_to_trash" = "commit",
): BoardData {
	return {
		columns: [
			{ id: "backlog", title: "Backlog", cards: [] },
			{ id: "in_progress", title: "In Progress", cards: [] },
			{
				id: "review",
				title: "Review",
				cards: [
					{
						id: "task-1",
						prompt: "Test task",
						startInPlanMode: false,
						autoReviewEnabled,
						autoReviewMode,
						baseRef: "main",
						createdAt: 1,
						updatedAt: 1,
					},
				],
			},
			{ id: "trash", title: "Trash", cards: [] },
		],
		dependencies: [],
	};
}

const defaultSnapshot: ReviewTaskWorkspaceSnapshot = {
	taskId: "task-1",
	path: "/tmp/task-1",
	branch: "task-1",
	isDetached: false,
	headCommit: "abc123",
	changedFiles: 3,
	additions: 10,
	deletions: 2,
};

const workspaceSnapshots: Record<string, ReviewTaskWorkspaceSnapshot> = {
	"task-1": { ...defaultSnapshot },
};

function HookHarness({
	board,
	runAutoReviewGitAction,
	requestMoveTaskToTrash,
}: {
	board: BoardData;
	runAutoReviewGitAction: (taskId: string, action: TaskGitAction) => Promise<boolean>;
	requestMoveTaskToTrash: (taskId: string, fromColumnId: BoardColumnId) => Promise<void>;
}): null {
	setTaskWorkspaceSnapshot(workspaceSnapshots["task-1"] ?? null);
	useReviewAutoActions({
		board,
		taskGitActionLoadingByTaskId: {},
		runAutoReviewGitAction,
		requestMoveTaskToTrash,
	});
	return null;
}

describe("useReviewAutoActions", () => {
	let container: HTMLDivElement;
	let root: Root;
	let previousActEnvironment: boolean | undefined;

	beforeEach(() => {
		vi.useFakeTimers();
		previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		resetWorkspaceMetadataStore();
		workspaceSnapshots["task-1"] = { ...defaultSnapshot };
		container.remove();
		if (previousActEnvironment === undefined) {
			delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
		} else {
			(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
				previousActEnvironment;
		}
		vi.useRealTimers();
	});

	it("does not move task to trash after PR auto-review completes", async () => {
		const runAutoReviewGitAction = vi.fn(async () => true);
		const requestMoveTaskToTrash = vi.fn(async () => {});

		// Render with PR mode enabled and working changes present
		await act(async () => {
			root.render(
				<HookHarness
					board={createBoard(true, "pr")}
					runAutoReviewGitAction={runAutoReviewGitAction}
					requestMoveTaskToTrash={requestMoveTaskToTrash}
				/>,
			);
		});

		// Trigger the PR git action
		await act(async () => {
			vi.advanceTimersByTime(1000);
		});
		expect(runAutoReviewGitAction).toHaveBeenCalledWith("task-1", "pr");

		// Simulate PR completion: changed files drop to 0
		workspaceSnapshots["task-1"] = { ...workspaceSnapshots["task-1"]!, changedFiles: 0 };
		await act(async () => {
			root.render(
				<HookHarness
					board={createBoard(true, "pr")}
					runAutoReviewGitAction={runAutoReviewGitAction}
					requestMoveTaskToTrash={requestMoveTaskToTrash}
				/>,
			);
		});

		await act(async () => {
			vi.advanceTimersByTime(1000);
		});

		// Task should NOT be moved to trash — it stays in Review for external automation
		expect(requestMoveTaskToTrash).not.toHaveBeenCalled();
	});

	it("moves task to trash after commit auto-review completes", async () => {
		const runAutoReviewGitAction = vi.fn(async () => true);
		const requestMoveTaskToTrash = vi.fn(async () => {});

		// Render with commit mode enabled and working changes present
		await act(async () => {
			root.render(
				<HookHarness
					board={createBoard(true, "commit")}
					runAutoReviewGitAction={runAutoReviewGitAction}
					requestMoveTaskToTrash={requestMoveTaskToTrash}
				/>,
			);
		});

		// Trigger the commit git action
		await act(async () => {
			vi.advanceTimersByTime(1000);
		});
		expect(runAutoReviewGitAction).toHaveBeenCalledWith("task-1", "commit");

		// Simulate commit completion: changed files drop to 0
		workspaceSnapshots["task-1"] = { ...workspaceSnapshots["task-1"]!, changedFiles: 0 };
		await act(async () => {
			root.render(
				<HookHarness
					board={createBoard(true, "commit")}
					runAutoReviewGitAction={runAutoReviewGitAction}
					requestMoveTaskToTrash={requestMoveTaskToTrash}
				/>,
			);
		});

		await act(async () => {
			vi.advanceTimersByTime(1000);
		});

		// Commit mode should still move to trash
		expect(requestMoveTaskToTrash).toHaveBeenCalledWith("task-1", "review", {
			skipWorkingChangeWarning: true,
		});
	});

	it("cancels a scheduled auto review action when autoReviewEnabled is turned off", async () => {
		const runAutoReviewGitAction = vi.fn(async () => true);
		const requestMoveTaskToTrash = vi.fn(async () => {});

		await act(async () => {
			root.render(
				<HookHarness
					board={createBoard(true)}
					runAutoReviewGitAction={runAutoReviewGitAction}
					requestMoveTaskToTrash={requestMoveTaskToTrash}
				/>,
			);
		});

		await act(async () => {
			root.render(
				<HookHarness
					board={createBoard(false)}
					runAutoReviewGitAction={runAutoReviewGitAction}
					requestMoveTaskToTrash={requestMoveTaskToTrash}
				/>,
			);
		});

		await act(async () => {
			vi.advanceTimersByTime(1000);
		});

		expect(runAutoReviewGitAction).not.toHaveBeenCalled();
		expect(requestMoveTaskToTrash).not.toHaveBeenCalled();
	});
});
