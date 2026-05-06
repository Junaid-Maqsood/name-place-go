const ADJECTIVES = [
  "Angry", "Happy", "Sneaky", "Mighty", "Silly", "Brave", "Crazy", "Swift",
  "Lucky", "Dizzy", "Funky", "Spicy", "Witty", "Jolly", "Cosmic", "Turbo",
  "Sleepy", "Grumpy", "Fuzzy", "Wild", "Epic", "Mystic", "Royal", "Toxic",
  "Frosty", "Blazing", "Shadow", "Golden", "Lazy", "Quirky",
];
const ANIMALS = [
  "Llama", "Koala", "Panda", "Otter", "Falcon", "Tiger", "Penguin", "Hippo",
  "Wolf", "Fox", "Eagle", "Shark", "Dragon", "Bunny", "Sloth", "Hawk",
  "Yeti", "Goblin", "Phoenix", "Ninja", "Pirate", "Wizard", "Robot", "Viking",
  "Moose", "Badger", "Octopus", "Raccoon", "Lemur", "Walrus",
];

export function randomGamertag(taken: string[] = []) {
  for (let i = 0; i < 25; i++) {
    const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const tag = `${a}${b}`;
    if (!taken.includes(tag)) return tag;
  }
  return `${ADJECTIVES[0]}${ANIMALS[0]}${Math.floor(Math.random() * 99)}`;
}
