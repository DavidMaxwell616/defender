import GameScene from './GameScene.js';

// Attract-mode enemy guide, arranged like assets/demo mode.png.
export default class DemoScene extends GameScene {
    constructor() {
        super('DemoScene');
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');
        this.startSpriteColorCycle();
        this.worldScroll = 0;
        this.createStars();
        this.createTerrain();
        const { width, height } = this.scale;
        const scale = Math.min(width / 960, height / 540);
        const label = (x, y, text, size = 22) => this.add.text(x, y, text, {
            fontFamily: 'monospace', fontSize: `${size * scale}px`,
            fontStyle: 'bold', color: '#6464ff', align: 'center'
        }).setOrigin(0.5).setDepth(10);

        this.hud = this.add.container(0, 0)
            .setScale(width / 1058, height / 772).setDepth(100);
        const scanner = this.add.graphics();
        scanner.lineStyle(4, 0x3500a0).strokeRect(317, 0, 461, 119);
        scanner.lineBetween(18, 119, 1052, 119);
        this.radarTerrain = this.add.graphics();
        this.hud.add([scanner, this.radarTerrain]);
        this.drawRadarTerrain();
        scanner.lineStyle(4, 0xffffff);
        scanner.beginPath();
        scanner.moveTo(521, 110);
        scanner.lineTo(521, 119);
        scanner.lineTo(574, 119);
        scanner.lineTo(574, 110);
        scanner.strokePath();
        label(width * 0.52, height * 0.19, 'S C A N N E R', 18);
        this.add.sprite(width * 0.2, height * 0.28, 'defender-sprites', 'hud-ship')
            .setScale(0.8 * scale);

        const entries = [
            { name: 'LANDER', score: 150, frames: Array.from({ length: 6 }, (_, i) => `lander-${i}`) },
            { name: 'MUTANT', score: 150, frames: ['mutant-0', 'mutant-1'] },
            { name: 'BAITER', score: 200, frames: ['75', '76', '77', '81', '82'] },
            { name: 'BOMBER', score: 250, frames: ['14', '15', '16', '17', '18'] },
            { name: 'POD', score: 1000, frames: ['07', '08', '10', '12'] },
            { name: 'SWARMER', score: 150, frames: ['40'] }
        ];
        entries.forEach((entry, index) => {
            const column = index % 3;
            const row = Math.floor(index / 3);
            const x = width * (0.25 + column * 0.25);
            const y = height * (0.4 + row * 0.27);
            const key = `demo-${entry.name.toLowerCase()}`;
            if (!this.anims.exists(key)) {
                this.anims.create({ key,
                    frames: entry.frames.map(frame => ({ key: 'defender-sprites', frame })),
                    frameRate: 8, repeat: -1 });
            }
            this.add.sprite(x, y, 'defender-sprites', entry.frames[0])
                .setScale(scale).play(key);
            label(x, y + 48 * scale, `${entry.name}\n${entry.score}`);
            scanner.fillStyle([0x00ff00, 0xff00ff, 0xffb000][column])
                .fillRect(535 + column * 14, 30 + row * 20, 5, 5);
        });
        label(width / 2, height * 0.96, 'PRESS ANY KEY OR CLICK TO START', 12);
        let starting = false;
        const start = () => {
            if (starting) return;
            starting = true;
            this.scene.start('GameScene', {
                wave: 1,
                score: 0,
                lives: 3,
                smartBombs: 3
            });
        };
        this.input.keyboard.once('keydown', start);
        this.input.once('pointerdown', start);
        this.events.once('shutdown', () => {
            this.input.keyboard.off('keydown', start);
            this.input.off('pointerdown', start);
        });
    }

    // The showcase animates sprites without running player controls or enemy AI.
    update() {}
}
