import { DefenderPalette } from './config.js';

const COLORS = Object.values(DefenderPalette)
    .map(color => Number.parseInt(color.hex.slice(1), 16))
    .filter(color => color !== 0);
// Distances behind the leading tip, with increasingly broken trailing streaks.
const SEGMENTS = [[0, 116], [124, 148], [158, 177], [189, 201],
    [215, 239], [256, 261], [274, 294], [308, 320], [334, 339]];

export default class LaserShot {
    constructor(scene, x, y, direction) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.distance = 0;
        this.colorElapsed = 0;
        this.color = Phaser.Utils.Array.GetRandom(COLORS);
        this.graphics = scene.add.graphics().setDepth(10);
    }

    update(delta) {
        const travel = 1400 * delta / 1000;
        this.x += travel * this.direction;
        this.distance += travel;
        this.colorElapsed += delta;
        if (this.colorElapsed >= 75) {
            this.colorElapsed %= 75;
            this.color = Phaser.Utils.Array.GetRandom(COLORS);
        }
        const graphics = this.graphics;
        graphics.clear().setPosition(Math.round(this.x), Math.round(this.y));
        graphics.setScale(this.direction, 1);
        for (const [start, end] of SEGMENTS) {
            // The trail grows from the muzzle and never extends behind it.
            const length = Math.min(end, this.distance) - start;
            if (length <= 0) continue;
            graphics.fillStyle(this.color, 0.18).fillRect(-start - length, -4, length, 8);
            graphics.fillStyle(this.color, 1).fillRect(-start - length, -2, length, 4);
        }
        graphics.fillStyle(0xffffff, 1).fillRect(-6, -1, 6, 2);
        return this.direction > 0
            ? this.x - 340 <= this.scene.scale.width
            : this.x + 340 >= 0;
    }

    destroy() {
        this.graphics.destroy();
    }
}
