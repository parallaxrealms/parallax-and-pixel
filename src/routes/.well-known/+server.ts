// Mute various DevTools and browser requests
export function GET() {
	return new Response('{}', {
		headers: {
			'Content-Type': 'application/json'
		}
	});
}
