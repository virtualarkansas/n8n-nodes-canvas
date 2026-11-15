/**
 * Runs once per `vitest run` of the integration battery, before any worker starts.
 * Gives the run an ID so tools reading the execution logs can tell reruns apart.
 */
export default function setup(): void {
	process.env.BATTERY_SESSION = String(Date.now());
}
