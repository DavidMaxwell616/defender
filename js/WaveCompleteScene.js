import GameScene from './GameScene.js';

export default class WaveCompleteScene extends GameScene {
    constructor() {
        super('WaveCompleteScene');
    }

    create({ score = 0, survivors = 0, wave = 1, lives = 3, smartBombs = 3 } = {}) {
        this.cameras.main.setBackgroundColor('#000000');
        this.startSpriteColorCycle();
        const texture = this.textures.get('defender-sprites');
        const glyphs = {};
        '012345678'.split('').forEach((char, i) => { glyphs[char] = [225 + i * 44, 201, 20]; });
        glyphs['9'] = [5, 253, 20];
        'ABCDEFGHIJK'.split('').forEach((char, i) => {
            glyphs[char] = [[121, 165, 209, 253, 297, 341, 385, 429, 473, 509, 553][i], 253, 20];
        });
        'LMNOPQRSTUVWX'.split('').forEach((char, i) => {
            glyphs[char] = [[5, 49, 101, 145, 189, 233, 277, 321, 361, 409, 453, 497, 549][i],
                305, [20, 28, 20, 20, 20, 20, 20, 20, 24, 20, 20, 24, 20][i]];
        });
        glyphs.Y = [5, 357, 20];
        glyphs.Z = [49, 357, 20];
        Object.entries(glyphs).forEach(([char, [x, y, width]]) => {
            if (!texture.has(`font-${char}`)) texture.add(`font-${char}`, 0, x, y, width, 28);
        });
        const scale = Math.min(1, this.scale.width / 900);
        const text = (message, y) => {
            const advance = 32 * scale;
            const left = this.scale.width / 2 - (message.length - 1) * advance / 2;
            [...message].forEach((char, i) => {
                if (char !== ' ') this.add.image(left + i * advance, y,
                    'defender-sprites', `font-${char}`).setScale(scale);
            });
        };
        text(`ATTACK WAVE ${wave} COMPLETED`, this.scale.height * 0.3);
        this.time.delayedCall(6000, () => this.scene.start('GameScene', { wave: wave + 1, score, lives, smartBombs }));
        this.time.delayedCall(1000, () => {
            text('BONUS X 100', this.scale.height * 0.46);
            const spacing = 32 * scale;
            for (let i = 0; i < survivors; i += 1) {
                this.add.sprite(this.scale.width / 2 + (i - (survivors - 1) / 2) * spacing,
                    this.scale.height * 0.59, 'defender-sprites', '13');
            }
            text(`BONUS ${survivors * 100}`, this.scale.height * 0.72);
            text(`SCORE ${score}`, this.scale.height * 0.84);
        });
    }

    update() {}
}
