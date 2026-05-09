// Animal-only avatars with display names (shown on hover/tap)
export const ANIMALS: { emoji: string; name: string }[] = [
  { emoji: "🦊", name: "Fox" },
  { emoji: "🐼", name: "Panda" },
  { emoji: "🦁", name: "Lion" },
  { emoji: "🐸", name: "Frog" },
  { emoji: "🐙", name: "Octopus" },
  { emoji: "🦄", name: "Unicorn" },
  { emoji: "🐵", name: "Monkey" },
  { emoji: "🐯", name: "Tiger" },
  { emoji: "🐧", name: "Penguin" },
  { emoji: "🐨", name: "Koala" },
  { emoji: "🦉", name: "Owl" },
  { emoji: "🐲", name: "Dragon" },
  { emoji: "🦋", name: "Butterfly" },
  { emoji: "🐳", name: "Whale" },
  { emoji: "🦒", name: "Giraffe" },
  { emoji: "🐢", name: "Turtle" },
  { emoji: "🦀", name: "Crab" },
  { emoji: "🦔", name: "Hedgehog" },
  { emoji: "🦦", name: "Otter" },
  { emoji: "🦥", name: "Sloth" },
  { emoji: "🦩", name: "Flamingo" },
];

export const ANIMAL_EMOJIS = ANIMALS.map((a) => a.emoji);

export function animalName(emoji: string): string {
  return ANIMALS.find((a) => a.emoji === emoji)?.name ?? "Animal";
}
