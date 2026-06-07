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

movement is with wasd, looking is with the mouse, shooting is left click, using items is right click, q/e is to switch weapons if multiple are held

the player character should be a simple character 'model' (pixel art / shapes are fine as long as it looks like a person roughly)

Fill out any details that are missing, e.g. the theming around where the player is getting their upgraded equipment from, what kind of valuables are discovered, the design / feel of the rooms, the design / feel of the enemies, and so on

The old flash game Motherload is the direct inspiration for this game if that helps.

Known bugs:
- right now the flashlight doesnt properly track the mouse. Specifically, as the user moves around using WASD, especially as they change direction, the flashlight starts to drift to a different location than where the actual mouse is. So if the mouse is in one place, it should keep pointing the flashlight in the right spot
