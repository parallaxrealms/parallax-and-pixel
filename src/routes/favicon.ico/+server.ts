// Mute favicon requests during development
export function GET() {
	return new Response('', {
		status: 204,
		headers: {
			'Content-Type': 'image/x-icon'
		}
	});
}
