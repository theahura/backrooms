import { mulberry32 } from './random.js';

const LORE_SEED_OFFSET = 90000;
const LORE_CHANCE = 0.25;

export const LORE_ENTRIES = [
  { id: 0, text: "If the buzzing stops, run. It means something nearby is absorbing the sound." },
  { id: 1, text: "I've been walking for three days. The rooms never change. I'm starting to think I haven't moved at all." },
  { id: 2, text: "Mark your path. The walls rearrange when you're not looking." },
  { id: 3, text: "Day 4. Or day 40. The fluorescent lights don't flicker at night because there is no night. There has never been a night." },
  { id: 4, text: "Don't drink the carpet water. I don't care how thirsty you are." },
  { id: 5, text: "I found my own handwriting on a wall I've never visited. It said KEEP GOING. I don't remember writing it." },
  { id: 6, text: "The worst part isn't the things in the dark. It's the yellow. Endless, nauseating yellow. It gets behind your eyes." },
  { id: 7, text: "If you see someone waving from across a room, check their face. If they don't have one, do not approach." },
  { id: 8, text: "Never run unless you're already being chased. Sound carries for miles here." },
  { id: 9, text: "The carpet is damp but it has not rained. The ceiling is dry. I've stopped asking where the moisture comes from." },
  { id: 10, text: "I miss weather. Wind, rain, anything. The air here doesn't move. It just hangs, warm and stale, like the building is exhaling." },
  { id: 11, text: "You will forget what the sun looks like. Write it down. When you can't remember, you're starting to belong here." },
  { id: 12, text: "There are six hundred million square miles of empty rooms and I have heard breathing in every single one." },
  { id: 13, text: "The stairs going down are not stairs. I watched the steps move. The building breathes and you are inside it." },
  { id: 14, text: "I can hear it mimicking my footsteps, half a second behind. If you find this note and there are two sets of tracks, follow neither." },
  { id: 15, text: "This is my third note. I can't find the first two. Either something is taking them or I'm leaving them in places that no longer exist." },
  { id: 16, text: "They hate the light. Keep your flashlight on. Always." },
  { id: 17, text: "The vending machines on the lower levels sometimes work. Stock up. Don't ask where the power comes from." },
  { id: 18, text: "I counted the same doorway three times. The carpet stain is identical. I am walking in a loop that shouldn't be geometrically possible." },
  { id: 19, text: "To whoever finds this: I'm sorry. I thought I could map it. Nobody can map it. It doesn't want to be mapped." },
];

export function generateRoomLore(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId, collectedLoreIds) {
  if (roomId === 0) return [];

  const rand = mulberry32(seed + LORE_SEED_OFFSET);

  if (rand() > LORE_CHANCE) return [];

  const available = LORE_ENTRIES.filter(e => !collectedLoreIds.has(e.id));
  if (available.length === 0) return [];

  const entry = available[Math.floor(rand() * available.length)];

  const margin = 40;
  const minX = roomX + wallThickness + margin;
  const minY = roomY + wallThickness + margin;
  const maxX = roomX + roomWidth - wallThickness - margin;
  const maxY = roomY + roomHeight - wallThickness - margin;
  const itemRadius = 8;

  for (let attempt = 0; attempt < 20; attempt++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);

    let overlaps = false;
    for (const f of furnitureItems) {
      if (
        x >= f.x - itemRadius &&
        x <= f.x + f.width + itemRadius &&
        y >= f.y - itemRadius &&
        y <= f.y + f.height + itemRadius
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      return [{ x, y, loreId: entry.id, text: entry.text }];
    }
  }

  return [];
}
