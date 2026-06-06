/** Shapes shared between the Telemetry tab and its server cards. Mirrors the
 *  sanitized Glances snapshot returned by GET /api/servers/[server]. */

export interface FsEntry {
	mnt_point: string;
	percent: number | null;
	size: number | null;
	used: number | null;
}

export interface ServerSnapshot {
	cpu: { total: number | null };
	mem: { percent: number | null; total: number | null; used: number | null };
	fs: FsEntry[];
	load: { min1: number | null; min5: number | null; min15: number | null; cpucore: number | null };
	uptime_seconds: number | null;
	now: string | null;
}
