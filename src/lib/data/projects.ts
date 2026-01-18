// Project type definition
export interface Project {
	id: string;
	title: string;
	slug: string;
	description: string;
	image: string;
	techStack: string[];
	liveUrl?: string;
	repoUrl?: string;
	featured: boolean;
	category: 'web' | 'game';
}

// Placeholder web projects
export const webProjects: Project[] = [
	{
		id: 'web-1',
		title: 'E-Commerce Platform',
		slug: 'ecommerce-platform',
		description: 'A full-featured e-commerce platform with payment processing, inventory management, and real-time order tracking. Built with SvelteKit and Supabase.',
		image: '/images/projects/placeholder-web-1.jpg',
		techStack: ['SvelteKit', 'TypeScript', 'Supabase', 'Stripe', 'Tailwind CSS'],
		liveUrl: 'https://example.com',
		repoUrl: 'https://github.com/example/project',
		featured: true,
		category: 'web'
	},
	{
		id: 'web-2',
		title: 'Dashboard Analytics',
		slug: 'dashboard-analytics',
		description: 'Real-time analytics dashboard with interactive charts, data visualization, and customizable widgets. Features dark mode and responsive design.',
		image: '/images/projects/placeholder-web-2.jpg',
		techStack: ['React', 'D3.js', 'Node.js', 'PostgreSQL', 'Chart.js'],
		liveUrl: 'https://example.com',
		featured: true,
		category: 'web'
	},
	{
		id: 'web-3',
		title: 'CMS Content Editor',
		slug: 'cms-content-editor',
		description: 'A rich text content management system with drag-and-drop editing, media uploads, and multi-tenant support.',
		image: '/images/projects/placeholder-web-3.jpg',
		techStack: ['SvelteKit', 'TipTap', 'Supabase', 'TypeScript'],
		repoUrl: 'https://github.com/example/project',
		featured: true,
		category: 'web'
	},
	{
		id: 'web-4',
		title: 'API Integration Hub',
		slug: 'api-integration-hub',
		description: 'Centralized API management platform for connecting third-party services, webhooks, and data synchronization.',
		image: '/images/projects/placeholder-web-4.jpg',
		techStack: ['Node.js', 'Express', 'Redis', 'MongoDB', 'Docker'],
		featured: false,
		category: 'web'
	}
];

// Placeholder game projects
export const gameProjects: Project[] = [
	{
		id: 'game-1',
		title: 'Pixel Dungeon Explorer',
		slug: 'pixel-dungeon-explorer',
		description: 'A roguelike dungeon crawler with procedurally generated levels, pixel art graphics, and permadeath mechanics. Features retro chiptune soundtrack.',
		image: '/images/projects/placeholder-game-1.jpg',
		techStack: ['Godot', 'GDScript', 'Aseprite', 'FMOD'],
		liveUrl: 'https://itch.io/example',
		featured: true,
		category: 'game'
	},
	{
		id: 'game-2',
		title: 'Space Commander',
		slug: 'space-commander',
		description: 'Top-down space shooter with wave-based combat, ship upgrades, and boss battles. Built with Unity and optimized for web browsers.',
		image: '/images/projects/placeholder-game-2.jpg',
		techStack: ['Unity', 'C#', 'WebGL', 'Photoshop'],
		liveUrl: 'https://example.com/play',
		repoUrl: 'https://github.com/example/game',
		featured: true,
		category: 'game'
	},
	{
		id: 'game-3',
		title: 'Puzzle Quest 3D',
		slug: 'puzzle-quest-3d',
		description: 'First-person puzzle game with physics-based mechanics, atmospheric environments, and mind-bending challenges.',
		image: '/images/projects/placeholder-game-3.jpg',
		techStack: ['Unreal Engine', 'Blueprints', 'Blender'],
		featured: true,
		category: 'game'
	},
	{
		id: 'game-4',
		title: 'Retro Racing',
		slug: 'retro-racing',
		description: 'Arcade-style racing game inspired by 90s classics. Features multiple tracks, vehicle customization, and local multiplayer.',
		image: '/images/projects/placeholder-game-4.jpg',
		techStack: ['Godot', 'Blender', 'GIMP'],
		featured: false,
		category: 'game'
	}
];

// Get featured projects
export function getFeaturedProjects(category: 'web' | 'game', limit = 3): Project[] {
	const projects = category === 'web' ? webProjects : gameProjects;
	return projects.filter(p => p.featured).slice(0, limit);
}

// Get all projects by category
export function getAllProjects(category: 'web' | 'game'): Project[] {
	return category === 'web' ? webProjects : gameProjects;
}
