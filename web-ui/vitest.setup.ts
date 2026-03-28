class MockIntersectionObserver implements IntersectionObserver {
	readonly root: Element | Document | null = null;
	readonly rootMargin = "";
	readonly thresholds = [0];

	disconnect(): void {}

	observe(_target: Element): void {}

	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}

	unobserve(_target: Element): void {}
}

Object.defineProperty(globalThis, "IntersectionObserver", {
	writable: true,
	configurable: true,
	value: MockIntersectionObserver,
});

/**
 * Node 22 ships a built-in `localStorage` that conflicts with jsdom's
 * implementation — its `clear()` (and other methods) may not exist or behave
 * differently.  Provide a simple in-memory Storage mock so tests that call
 * `window.localStorage.clear()` work reliably regardless of Node version.
 */
class InMemoryStorage implements Storage {
	private store = new Map<string, string>();

	get length(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	key(index: number): string | null {
		const keys = [...this.store.keys()];
		return keys[index] ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}

	[Symbol.iterator](): IterableIterator<string> {
		return this.store.keys();
	}
}

const mockLocalStorage = new InMemoryStorage();

Object.defineProperty(globalThis, "localStorage", {
	writable: true,
	configurable: true,
	value: mockLocalStorage,
});

if (typeof window !== "undefined") {
	Object.defineProperty(window, "localStorage", {
		writable: true,
		configurable: true,
		value: mockLocalStorage,
	});
}
