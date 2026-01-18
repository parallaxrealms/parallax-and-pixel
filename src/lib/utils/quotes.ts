// Collection of quotes from The Tao of Programming by Geoffrey James
export const quotes = [
	"The Tao that can be programmed is not the true Tao.",
	"A program should be light and agile, its subroutines connected like a string of pearls.",
	"The wise programmer is told about Tao and follows it. The average programmer is told about Tao and searches for it. The foolish programmer is told about Tao and laughs at it.",
	"When the program is debugged, the wise programmer walks away. The foolish programmer continues to poke at the code.",
	"A well-written program is its own Heaven; a poorly-written program is its own Hell.",
	"Without the wind, the grass does not move. Without software, hardware is useless.",
	"Though a program be but three lines long, someday it will have to be maintained.",
	"A program should follow the Law of Least Astonishment. What is this law? It is simply that the program should always respond to the user in the way that astonishes them least.",
	"The master programmer moves from program to program without fear. No change in management can harm them. They will not be fired, even if the project is cancelled.",
	"There is no beginning to the Tao, just as there are no bugs in the Tao. The Tao is hidden in all software.",
	"After three days without programming, life becomes meaningless.",
	"The best programmer is the one whose code other programmers can understand.",
	"Simplicity is the ultimate sophistication in programming.",
	"Each language has its purpose, however humble. Each language expresses the Yin and Yang of software.",
	"In the beginning was the Tao. The Tao gave birth to Space and Time. Therefore Space and Time are the Yin and Yang of programming.",
	"Hardware meets software at the interface of Yin and Yang.",
	"Something mysterious is formed, born in the silent void. Waiting alone and unmoving, it is at once still and yet in constant motion. It is the source of all programs. I do not know its name, so I will call it the Tao of Programming.",
	"The Tao is beyond words. It existed before the first line of code was ever written.",
	"If the Tao is great, then the operating system is great. If the operating system is great, then the compiler is great.",
	"When managers hold endless meetings, the programmers write games. When accountants talk of quarterly profits, the development budget is about to be cut."
];

/**
 * Returns a random quote from the collection
 */
export function getRandomQuote(): string {
	const index = Math.floor(Math.random() * quotes.length);
	return quotes[index];
}
