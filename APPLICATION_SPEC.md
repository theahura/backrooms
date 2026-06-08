<system-reminder> I will continually update this document as time goes on based on playtesting feedback. Simply commit changes to this doc like anything else. </system-reminder>

Backrooms is a survival horror top down 2d twin stick shooter, based on the 'backrooms' creepypasta concept.

The game is built entirely with web technologies -- html, js, css. Node libraries are fine, so are game engines if needed.

The basic idea:
- the player is an explorer who enters into the backrooms each 'day'
- the backrooms themselves are all pitch black
- the only thing that is visible are areas that are lit by the players flashlight (where they are looking)
- rooms are connected to each other in a variety of ways, including stairs
- rooms may have weapons, enemies, powerups, batteries, lightswitches, lore, and treasure / valuables of various kinds
  - for now, start with a single type of enemy, a zombie that will move towards the player if the player is visible but will stop once the player is out of line of sight of the zombie (at which point it will just move around randomly)
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

Next things to build:
- add audio
- add more enemy types
- add more room types
- add actual pixel art elements for things like tables, light switches, rewards, etc. instead of the current rectangle boxes
  - use this opportunity to also give the backrooms each more flavor
- add actual pixel art animations for the enemies and the main player character
- when an enemy dies, its body should remain
- enemies shouldnt disappear in rooms with light automatically
- make it so that one kind of enemy can open doors
- make it so that more and more difficult enemies spawn as the player spends more time outside of the safe rooms

Known bugs:
- NA
