import SplashScene from './SplashScene.js';
import GameScene from './GameScene.js';
import DemoScene from './DemoScene.js';
import WaveCompleteScene from './WaveCompleteScene.js';
import GameOverScene from './GameOverScene.js';

const config = {
    type: Phaser.WEBGL,
    parent: 'game',
    width: 960,
    height: 540,
    backgroundColor: '#000000',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [SplashScene, DemoScene, GameScene, WaveCompleteScene, GameOverScene]
};

new Phaser.Game(config);
