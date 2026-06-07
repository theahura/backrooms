function splitWall(start, y, wallLength, doors, isHorizontal) {
  const makeSegment = isHorizontal
    ? (a, b) => ({ x1: a, y1: y, x2: b, y2: y })
    : (a, b) => ({ x1: y, y1: a, x2: y, y2: b });

  if (doors.length === 0) {
    return [makeSegment(start, start + wallLength)];
  }

  const sorted = [...doors].sort((a, b) => a.offset - b.offset);
  const segments = [];
  let cursor = 0;

  for (const door of sorted) {
    if (door.offset > cursor) {
      segments.push(makeSegment(start + cursor, start + door.offset));
    }
    cursor = door.offset + door.width;
  }

  if (cursor < wallLength) {
    segments.push(makeSegment(start + cursor, start + wallLength));
  }

  return segments;
}

function reverseSegments(segments, isHorizontal) {
  return segments.reverse().map(s => {
    if (isHorizontal) {
      return { x1: s.x2, y1: s.y1, x2: s.x1, y2: s.y2 };
    }
    return { x1: s.x1, y1: s.y2, x2: s.x2, y2: s.y1 };
  });
}

export function createRoomWalls(x, y, width, height, doors = []) {
  const wallDoors = {
    north: doors.filter(d => d.wall === 'north'),
    south: doors.filter(d => d.wall === 'south'),
    east: doors.filter(d => d.wall === 'east'),
    west: doors.filter(d => d.wall === 'west'),
  };

  const segments = [];

  segments.push(...splitWall(x, y, width, wallDoors.north, true));
  segments.push(...splitWall(y, x + width, height, wallDoors.east, false));
  segments.push(...reverseSegments(splitWall(x, y + height, width, wallDoors.south, true), true));
  segments.push(...reverseSegments(splitWall(y, x, height, wallDoors.west, false), false));

  return segments;
}
