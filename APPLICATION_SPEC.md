<system-reminder> I will continually update this document as time goes on based on playtesting feedback. Simply commit changes to this doc like anything else. </system-reminder>

Backrooms is a survival horror top down 2d twin stick shooter, based on the 'backrooms' creepypasta concept.

The game is built entirely with web technologies -- html, js, css. Node libraries are fine, so are game engines if needed.

The basic idea:
- the player is an explorer who enters into the backrooms each 'day'
- the backrooms themselves are all pitch black
- the only thing that is visible are areas that are lit by the players flashlight (where they are looking)
- rooms are connected to each other in a variety of ways, including stairs
- rooms may have weapons, enemies, powerups, batteries, lightswitches, lore, and treasure / valuables of various kinds
  - rooms can have areas where players can hide, including under tables and beds, inside vents, armoirs, and closets
  - some room connectios should have closable doors
  - some rooms should have light switches that will turn on the lights in that room and prevent enemies from spawning there (though enemies can still find their way in from other areas)
- the player must make it back to the entrance point (or, in rare cases, discover a new entrance point) before their flashlight battery runs out
- once the player exits, they will be able to trade the treasure / valuables they collect for resources that improve their ability to explore. Ideas include:
  - backpack / items that increase storage space for carrying more treasure, resources
  - starting weapons of various kinds
  - longer flashlight battery
  - more powerful flashlight (covers more of the room)
  - compass / map that fills in as the player goes
- each day starts in the same 'room'. The starting room should look like a furniture store that has a crack in the wall that leads to the backrooms. If the player discovers a different 'exit', it should lead to a different location that the player ends up in. These locations should just be normal locations; have a few that the player can cycle through as needed

The actual view of the top down should be that the camera is centered on the player character, fixed fov. As the player moves, the camera stays on them.

movement is with wasd, looking is with the mouse, shooting is left click, using items is right click or e, q or scroll to switch weapons if multiple are held

on mobile/touch devices the game uses full-screen landscape twin-stick controls instead: the left on-screen stick moves the player, the right on-screen stick aims the flashlight, a dedicated FIRE button shoots (a generic screen touch never fires), and on-screen USE / WPN / BATT / FS buttons handle interact, weapon switch, battery use, and fullscreen. The game is landscape-only -- in portrait a full-screen prompt asks the player to rotate the device sideways

The player character should be a simple character 'model' (pixel art / shapes are fine as long as it looks like a person roughly)

The old flash game Motherload is the direct inspiration for this game.

Other details (from playtesting):
- tables shouldnt block light
- there should be more doors and stairs per room
- the map should not be available immediately (it should be very expensive)
- guns should have ammo
- player shouldnt start with a gun
- the starting location should have a standard entry -- that entry shouldnt move; and the 'shop' should be in the center of the 'furniture shop' and not in the edge blocking the door
- the player should be able to move around under a table while hidden
- most rooms should NOT have light switches -- these should be extremely rare
- enemies should be able to move between rooms
- the rooms should be generated dynamically, as the player explores. A given set of rooms should be generated 2 rooms out. The best way to do this is with procedural generation
  - these rooms should then remain static once they are generated, so the player really feels like there is consistency to the rooms they are exploring but also that the rooms themselves are changing from person to person
- the shop should show a 2d pixel art of the shop, and show pixel art representations of the things being bought
- There should only be one entrance to the backrooms from the furniture shop.
  - Entering should feel like the user transitions to a new dimension. Right now it just looks like another room.
  - As the player approaches the edge, there should be a strange crackling sound that gets louder, and only when the player goes through does the backroom appear. This is not a 'door' like the other doors, it should behave differently (e.g. no light leakage, it shows up on screen as a sizzling light in the wall edge)
- The player should be able to turn off the flashlight to conserve battery, and it should automatically turn off when they are hiding

Feedback from me (DO NOT CHANGE):
- the pixel art of the player character is totally wrong. It's a front facing view of a character instead of a top down view! Same is true of many of the enemies
  - in general, i think the player character needs to be bigger on screen (cf also the room needs to be smaller). If the camera is closer to the player in smaller rooms it will emphasize a claustrophobic feeling
  - most of the pixel art is not facing the right direction (e.g. the armoire is also front facing instead of top down)
  - and it is all basically way too small. What kind of sprite is 18x18! that is so small the player cant really make it out at all
  - I think the player character view should be top down -- we should see the top of the head, the shoulders, and the flashlight with arm stuck out. Similar for all the other sprites.
- zombies and other enemies should not follow the player once they lose line of sight. That includes walls and hiding state.
- gunfire should go over tables and desks and low furniture, should be blocked by armoires and other furniture

Known bugs:
- Hiding places, stairs, and doors will often spawn inside walls
