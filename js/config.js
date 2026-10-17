export const DefenderPalette = Object.freeze({
    BLACK: Object.freeze({
        hex: "#000000",
        rgb: "rgb(0, 0, 0)",
        description: "Space Background / Empty Void"
    }),
    PLAYER_SHIP_WHITE: Object.freeze({
        hex: "#FFFFFF",
        rgb: "rgb(255, 255, 255)",
        description: "Defender Ship Highlights & Laser Fire"
    }),
    PLAYER_SHIP_RED: Object.freeze({
        hex: "#FF0000",
        rgb: "rgb(255, 0, 0)",
        description: "Defender Ship Accents & Explosion Particles"
    }),
    LANDER_GREEN: Object.freeze({
        hex: "#00FF00",
        rgb: "rgb(0, 255, 0)",
        description: "Lander Alien / Main Threat Grid"
    }),
    MUTANT_MEGENTA: Object.freeze({
        hex: "#FF00FF",
        rgb: "rgb(255, 0, 255)",
        description: "Mutant Alien (Enraged Lander Variant)"
    }),
    BAITER_TEAL: Object.freeze({
        hex: "#00FFFF",
        rgb: "rgb(0, 255, 255)",
        description: "Baiter (High-Speed Interceptor Enemy)"
    }),
    BOMBER_YELLOW: Object.freeze({
        hex: "#FFFF00",
        rgb: "rgb(255, 255, 0)",
        description: "Bomber Alien & Static Mine Elements"
    }),
    HUMAN_MAGENTA: Object.freeze({
        hex: "#E040A0",
        rgb: "rgb(224, 64, 160)",
        description: "Humanoid Astronaunts on Ground Terrain"
    }),
    TERRAIN_V1_BLUE: Object.freeze({
        hex: "#0000FF",
        rgb: "rgb(0, 0, 255)",
        description: "Mountain Line / Scanner Grid (Early Blue ROM Set)"
    }),
    TERRAIN_V2_GREEN: Object.freeze({
        hex: "#00A000",
        rgb: "rgb(0, 160, 0)",
        description: "Mountain Line / Scanner Grid (Standard Green ROM Set)"
    }),
    SWARMER_RED: Object.freeze({
        hex: "#D00000",
        rgb: "rgb(208, 0, 0)",
        description: "Swarmer Entities escaping from Pods"
    }),
    POD_ORANGE: Object.freeze({
        hex: "#FF8000",
        rgb: "rgb(255, 128, 0)",
        description: "Pod Alien (Carries Swarmers)"
    }),
    HUD_TEXT_AMBER: Object.freeze({
        hex: "#FFB000",
        rgb: "rgb(255, 176, 0)",
        description: "Score Text & Vector UI Font Values"
    }),
    PARTICLE_CYAN: Object.freeze({
        hex: "#40C0E0",
        rgb: "rgb(64, 192, 224)",
        description: "Smart Bomb Flare Effect & Starfield Dust"
    }),
    PARTICLE_PURPLE: Object.freeze({
        hex: "#A020F0",
        rgb: "rgb(160, 32, 240)",
        description: "Hyperspace Disruption Flash Accent"
    }),
    SHIELD_GRAY: Object.freeze({
        hex: "#808080",
        rgb: "rgb(128, 128, 128)",
        description: "System Warnings / Diagnostic Screen State Flags"
    })
});

// Example Usage:
// const activeTerrainColor = DefenderPalette.TERRAIN_V2_GREEN.hex;
// console.log(`Rendering mountain baseline with: ${activeTerrainColor}`);
