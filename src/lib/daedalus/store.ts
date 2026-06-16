// DAEDALUS scene persistence. Prefers the shared DB table (nine.daedalus_scenes,
// cross-team) and transparently falls back to localStorage when the table isn't
// reachable yet (the odin→nine migration is operator-gated). The Studio/Library
// hold a `source` ('db' | 'local') and pass it back into mutations so reads and
// writes stay on the same backend within a session.
import { browser } from '$app/environment';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SceneDoc } from './schema';

const LS_SCENES = 'pxp-daedalus-scenes';
const LS_FOLDERS = 'pxp-daedalus-folders';
const TABLE = 'daedalus_scenes';

export type StoreSource = 'db' | 'local';
export interface SceneStore {
	scenes: SceneDoc[];
	/** Explicit folder paths (incl. empty folders). */
	folders: string[];
	source: StoreSource;
}

type Client = SupabaseClient | null | undefined;

// ── localStorage backend ───────────────────────────────────────────────────
function lsLoadScenes(): SceneDoc[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(LS_SCENES);
		return raw ? (JSON.parse(raw) as SceneDoc[]) : [];
	} catch {
		return [];
	}
}
function lsSaveScenes(scenes: SceneDoc[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(LS_SCENES, JSON.stringify(scenes));
	} catch {
		/* quota / disabled — ignore */
	}
}
function lsLoadFolders(): string[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(LS_FOLDERS);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch {
		return [];
	}
}
function lsSaveFolders(folders: string[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(LS_FOLDERS, JSON.stringify([...new Set(folders)].filter(Boolean)));
	} catch {
		/* ignore */
	}
}

// ── DB row mapping ──────────────────────────────────────────────────────────
function clone(scene: SceneDoc): SceneDoc {
	return JSON.parse(JSON.stringify(scene)) as SceneDoc;
}
function rowToScene(r: Record<string, unknown>): SceneDoc {
	const doc = (r.doc ?? {}) as SceneDoc;
	return {
		...doc,
		id: r.id as string,
		name: (r.name as string) ?? doc.name ?? 'Untitled',
		description: (r.description as string) ?? doc.description ?? '',
		folder: (r.folder as string) ?? ''
	};
}
export function sceneToRow(scene: SceneDoc, sortOrder = 0) {
	return {
		id: scene.id,
		name: scene.name,
		description: scene.description ?? '',
		folder: scene.folder ?? '',
		primitive: scene.primitive,
		doc: clone(scene),
		is_folder: false,
		sort_order: sortOrder
	};
}

function db(_supabase: Client): ReturnType<SupabaseClient['from']> | null {
	// PxP MVP port: force localStorage-only. PxP has no daedalus_scenes table yet
	// (the 9realms build read nine.daedalus_scenes). Returning null makes every
	// store function below degrade cleanly to its localStorage branch.
	//
	// To re-enable DB persistence later: create a `public.daedalus_scenes` migration
	// (id, name, description, folder, primitive, doc jsonb, is_folder, sort_order)
	// and return `_supabase ? _supabase.from(TABLE) : null` here (drop the
	// `.schema('nine')` — PxP is single-tenant on the public schema).
	void TABLE;
	return null;
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function loadStore(supabase: Client): Promise<SceneStore> {
	const table = db(supabase);
	if (table) {
		try {
			const { data, error } = await table.select('*').order('sort_order', { ascending: true });
			if (!error && data) {
				const rows = data as Record<string, unknown>[];
				const scenes = rows.filter((r) => !r.is_folder).map(rowToScene);
				const folders = rows
					.filter((r) => r.is_folder)
					.map((r) => r.folder as string)
					.filter(Boolean);
				return { scenes, folders, source: 'db' };
			}
		} catch {
			/* table missing / offline → fall back */
		}
	}
	return { scenes: lsLoadScenes(), folders: lsLoadFolders(), source: 'local' };
}

export async function persistScene(supabase: Client, source: StoreSource, scene: SceneDoc): Promise<void> {
	if (source === 'db') {
		await db(supabase)?.upsert(sceneToRow(scene));
		return;
	}
	const all = lsLoadScenes();
	const i = all.findIndex((s) => s.id === scene.id);
	if (i >= 0) all[i] = clone(scene);
	else all.push(clone(scene));
	lsSaveScenes(all);
}

export async function removeScene(supabase: Client, source: StoreSource, id: string): Promise<void> {
	if (source === 'db') {
		await db(supabase)?.delete().eq('id', id);
		return;
	}
	lsSaveScenes(lsLoadScenes().filter((s) => s.id !== id));
}

export async function moveScene(
	supabase: Client,
	source: StoreSource,
	id: string,
	folder: string
): Promise<void> {
	if (source === 'db') {
		await db(supabase)?.update({ folder }).eq('id', id);
		return;
	}
	const all = lsLoadScenes();
	const s = all.find((x) => x.id === id);
	if (s) {
		s.folder = folder;
		lsSaveScenes(all);
	}
}

export async function createFolder(supabase: Client, source: StoreSource, path: string): Promise<void> {
	const clean = normalizeFolder(path);
	if (!clean) return;
	if (source === 'db') {
		await db(supabase)?.upsert({
			id: `folder-${clean}`,
			name: lastSegment(clean),
			description: '',
			folder: clean,
			primitive: '_folder',
			doc: {},
			is_folder: true,
			sort_order: 0
		});
		return;
	}
	lsSaveFolders([...lsLoadFolders(), clean]);
}

export async function renameFolder(
	supabase: Client,
	source: StoreSource,
	from: string,
	to: string
): Promise<void> {
	const a = normalizeFolder(from);
	const b = normalizeFolder(to);
	if (!a || a === b) return;
	const reprefix = (f: string) => (f === a ? b : f.startsWith(a + '/') ? b + f.slice(a.length) : f);
	if (source === 'db') {
		const table = db(supabase);
		if (!table) return;
		const { data } = await table.select('id, folder, is_folder');
		for (const r of (data ?? []) as Record<string, unknown>[]) {
			const cur = (r.folder as string) ?? '';
			const next = reprefix(cur);
			if (next === cur) continue;
			if (r.is_folder) {
				await table.update({ folder: next, id: `folder-${next}`, name: lastSegment(next) }).eq('id', r.id as string);
			} else {
				await table.update({ folder: next }).eq('id', r.id as string);
			}
		}
		return;
	}
	lsSaveScenes(lsLoadScenes().map((s) => ({ ...s, folder: reprefix(s.folder ?? '') })));
	lsSaveFolders(lsLoadFolders().map(reprefix));
}

/** Delete an (empty) folder placeholder. Scenes inside should be moved/deleted first. */
export async function deleteFolder(supabase: Client, source: StoreSource, path: string): Promise<void> {
	const clean = normalizeFolder(path);
	if (!clean) return;
	if (source === 'db') {
		await db(supabase)?.delete().eq('is_folder', true).eq('folder', clean);
		return;
	}
	lsSaveFolders(lsLoadFolders().filter((f) => f !== clean));
}

// ── Folder path helpers ───────────────────────────────────────────────────────
export function normalizeFolder(path: string): string {
	return path
		.split('/')
		.map((s) => s.trim())
		.filter(Boolean)
		.join('/');
}
export function lastSegment(path: string): string {
	const parts = normalizeFolder(path).split('/');
	return parts[parts.length - 1] ?? '';
}
export function parentFolder(path: string): string {
	const parts = normalizeFolder(path).split('/');
	parts.pop();
	return parts.join('/');
}

/**
 * All folder paths present across scenes + explicit folders, including every
 * intermediate prefix (so 'a/b/c' yields 'a', 'a/b', 'a/b/c'). Sorted.
 */
export function allFolderPaths(scenes: SceneDoc[], explicit: string[]): string[] {
	const set = new Set<string>();
	const add = (full: string) => {
		const parts = normalizeFolder(full).split('/').filter(Boolean);
		let acc = '';
		for (const p of parts) {
			acc = acc ? `${acc}/${p}` : p;
			set.add(acc);
		}
	};
	for (const s of scenes) if (s.folder) add(s.folder);
	for (const f of explicit) add(f);
	return [...set].sort();
}
