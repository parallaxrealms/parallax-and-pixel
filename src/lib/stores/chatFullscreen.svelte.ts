// Shared flag for the Bifrost chat's app-like fullscreen mode.
//
// When on, the dashboard layout hides its chrome (top navbar, left dashboard
// sidebar, bottom status bar, mobile bottom nav) and gives the chat the whole
// viewport — so the chat header sits at the very top and the conversation
// sidebar acts as the full-height left rail. Especially nicer on mobile.
//
// It's a module-level rune so the chat (which toggles it) and the dashboard
// layout (which reacts to it) share one source of truth. BifrostChat resets it
// on destroy so navigating away can never leave the chrome hidden.

let _fullscreen = $state(false);

/** Reactive read — call inside a component/$derived/template to track it. */
export function isChatFullscreen(): boolean {
	return _fullscreen;
}

export function setChatFullscreen(value: boolean): void {
	_fullscreen = value;
}

export function toggleChatFullscreen(): void {
	_fullscreen = !_fullscreen;
}

// Generic aliases — the same flag now also drives DAEDALUS Studio fullscreen.
// Only one surface owns it at a time (you're on one mode), and each surface
// resets it on destroy so navigating away never leaves the chrome hidden.
export const isFullscreen = isChatFullscreen;
export const setFullscreen = setChatFullscreen;
export const toggleFullscreen = toggleChatFullscreen;
