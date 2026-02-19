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
	devlogUrl?: string;
	featured: boolean;
	category: 'web' | 'game';
}

// Placeholder web projects
export const webProjects: Project[] = [
	{
		id: 'web-1',
		title: 'Satori Digital',
		slug: 'satori-digital',
		description: 'Web, App & Branding Company I work for. We work with local individuals and businesses to get their ideas off the ground and build a digital presence.',
		image: '/preview/satori-digital.webp',
		techStack: ['SvelteKit', 'TypeScript', 'Custom Components/Animations'],
		liveUrl: 'https://satoridigital.io',
		featured: true,
		category: 'web'
	},
	{
		id: 'web-2',
		title: 'The Peoples Place AVL',
		slug: 'the-peoples-place-avl',
		description: 'A collective space for learning, imagining, nourishing, healing, and engaging in meaningful conversations.',
		image: '/preview/ppl-avl.webp',
		techStack: ['E-commerce', 'Community', 'App', 'Blog'],
		liveUrl: 'https://peoplesplaceavl.com',
		featured: true,
		category: 'web'
	},
	{
		id: 'web-3',
		title: 'Custom AVL',
		slug: 'custom-avl',
		description: 'Custom AVL is a local Asheville, NC business bringing creative visions to life through high-quality custom printing and apparel. Complete merchandise solutions for businesses, bands, breweries, and organizations. From concept to delivery, we handle it all.',
		image: '/preview/custom-avl.webp',
		techStack: ['E-commerce', 'Client-focused', 'Bulk Orders', 'Apparel Customization'],
		liveUrl: 'https://www.customavl.com',
		featured: true,
		category: 'web'
	},
	{
		id: 'web-4',
		title: 'LIVE FREE DYE HARD',
		slug: 'live-free-dye-hard',
		description: 'Online Shop for one-of-a-kind hand-dyed tie-dye apparel.',
		image: '/preview/lfdh.webp',
		techStack: ['E-commerce', 'Hand-crafted Goods'],
		liveUrl: 'https://www.livefreedyehard.com/',
		featured: false,
		category: 'web'
	},
	{
		id: 'web-6',
		title: 'Veilwriter',
		slug: 'veilwriter',
		description: 'Veilwriter is a minimalist, privacy-first web app for writing and protecting personal text — journal entries, notes, or ideas — without accounts, ads, or tracking. Everything happens client-side. Users type into a simple text area that can instantly mask content behind symbols, keeping screens private.',
		image: '/preview/veilwriter.webp',
		techStack: ['App', 'Fun', 'Utility'],
		liveUrl: 'https://veilwriter.yggdrasil.quest/',
		featured: false,
		category: 'web'
	},
	{
		id: 'web-7',
		title: 'Guessemon',
		slug: 'web game',
		description: 'A fun project to learn new things. Wordle meets Pokémon! Challenges players to guess the name of a randomly selected Pokémon. On page load, a random Pokémon is fetched from PokéAPI , and its name is set as the answer to the word puzzle. Three leagues to play based on your knowledge of the Pokemon Generations.',
		image: '/preview/guessemon.webp',
		techStack: ['Svelte 5', 'TypeScript', 'Node.js', 'PokéAPI'],
		liveUrl: 'https://guessemon.com',
		repoUrl: 'https://github.com/parallaxrealms/guessemon-sv5',
		featured: true,
		category: 'web'
	}
];

// Placeholder game projects
export const gameProjects: Project[] = [
	{
		id: 'game-1',
		title: 'Project Cursed Palemire',
		slug: 'project-cursed-palemire',
		description: 'A roguelike RPG dungeon crawler I am currently working on. Playable build not available yet but stay tuned via the devlog.',
		image: '/preview/cursed-palemire.webp',
		devlogUrl: '/blog/',
		techStack: ['Godot', 'GDScript', 'Aseprite', 'Blender'],
		featured: true,
		category: 'game'
	},
	{
		id: 'game-2',
		title: 'Pull Yourself Together',
		slug: 'pull-yourself-together',
		description: 'A 2D platformer I made for a Metroidvania-based game jam in 2022 with some unique body-part swapping mechanics. Every asset in this game is hand-made in aseprite from scratch. skittlegirlsound provided background music for the levels ,and menu/credits music is by Luke Holizna. I spent a few months extra polishing the gameplay demo, but it remains a demo still. You play an easily-broken robot who must keep themselves together while trying to escape danger in an underground cave system.',
		image: '/preview/pull-yourself-together.webp',
		techStack: ['Unity', 'Aseprite', 'C#', '2D Platformer', 'Metroidvania'],
		liveUrl: 'https://parallaxpixels.itch.io/pull-yourself-together',
		featured: true,
		category: 'game'
	},
	{
		id: 'game-3',
		title: 'The Providence Phenomenon',
		slug: 'the-providence-phenomenon',
		description: 'Horror adventure game with puzzles and dialogue. Based on old-school PC point and click adventure games. This was made in just 2 weeks for an Adventure Game Jam in 2023. Another developer (John Kruchowski) helped with level design, puzzles and bug fixing. I made the 2D assets such as portraits, UI elements, in-game environment textures and wrote all of the dialogue.',
		image: '/preview/providence-phenomenon.webp',
		techStack: ['Unity', 'C#', 'First-Person', '3D/2D Assets', 'Horror Atmosphere'],
		liveUrl: 'https://parallaxpixels.itch.io/the-providence-phenomenon',
		featured: true,
		category: 'game'
	},
	{
		id: 'game-4',
		title: 'Glowbug',
		slug: 'glowbug',
		description: 'A very simple arcade-y game I made for another game jam in 2022 called Low Res Jam. The challenge was to build a game with only 64x64 pixels in the entire screen. You move around and must eat smaller/equal sized bugs to grow bigger, while avoiding bigger bugs.',
		image: '/preview/glowbug.webp',
		liveUrl: 'https://parallaxpixels.itch.io/glowbug64',
		techStack: ['Unity', 'Aseprite', 'C#'],
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
