export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    create({ score = 0 } = {}) {
        this.cameras.main.setBackgroundColor('#000000');
        const { width, height } = this.scale;
        this.add.text(width / 2, height * 0.43, 'GAME OVER', {
            fontFamily: 'monospace', fontSize: '48px',
            fontStyle: 'bold', color: '#ff4040'
        }).setOrigin(0.5);
        this.add.text(width / 2, height * 0.58, `SCORE ${score}`, {
            fontFamily: 'monospace', fontSize: '24px', color: '#ffb000'
        }).setOrigin(0.5);
        this.time.delayedCall(3000, () => this.scene.start('DemoScene'));
    }
}
