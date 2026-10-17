import { DefenderPalette } from './config.js';

export default class SplashScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SplashScene' });
    }

    preload() {
        this.load.image('defrug1', 'assets/defrug1.png');
        this.load.image('defrug2', 'assets/defrug2.png');
        this.load.image('defasg', 'assets/defasg.png');
        this.load.spritesheet('title', 'assets/title.png', {
            frameWidth: 218,
            frameHeight: 64
        });
        this.load.image('intro2', 'assets/intro2.png');
        this.load.image('intro-explode', 'assets/intro 3 reverse explode.png');
        this.load.image('intro3', 'assets/intro3.png');
        this.load.image('intro4', 'assets/intro4.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');
        const { width, height } = this.scale;
        const rug1 = this.add.image(0, 0, 'defrug1').setOrigin(0).setDisplaySize(width, height);
        const rug2 = this.add.image(0, 0, 'defrug2').setOrigin(0).setDisplaySize(width, height);
        const strips1 = this.make.graphics({ x: 0, y: 0, add: false });
        const strips2 = this.make.graphics({ x: 0, y: 0, add: false });
        rug1.setMask(strips1.createGeometryMask());
        rug2.setMask(strips2.createGeometryMask());

        const stripWidth = 16;
        const period = stripWidth * 2;
        const drawStrips = offset => {
            strips1.clear().fillStyle(0xffffff);
            strips2.clear().fillStyle(0xffffff);
            for (let x = offset - period; x < width; x += period) {
                strips1.fillRect(x, 0, stripWidth, height);
                strips2.fillRect(x + stripWidth, 0, stripWidth, height);
            }
        };
        drawStrips(0);
        const scan = this.tweens.addCounter({
            from: 0,
            to: period,
            duration: 400,
            repeat: -1,
            onUpdate: tween => drawStrips(Math.floor(tween.getValue()))
        });
        const clearRomTest = () => {
            scan.remove();
            rug1.clearMask(true);
            rug2.clearMask(true);
            rug1.destroy();
            rug2.destroy();
            strips1.destroy();
            strips2.destroy();
        };
        this.events.once('shutdown', clearRomTest);
        this.time.delayedCall(3000, () => {
            this.events.off('shutdown', clearRomTest);
            clearRomTest();
            const diagnostic = this.add.image(width / 2, height / 2, 'defasg')
                .setOrigin(0.5).setScale(2);
            this.time.delayedCall(3000, () => {
                diagnostic.destroy();
                this.startTitleSequence();
            });
        });
    }

    startTitleSequence() {
        // Neutral masks let palette tints replace the source colors accurately.
        this.createTintTexture('intro2');
        this.createTintTexture('intro4');
        this.createTintTexture('intro3', true);
        // The exported sheet has 5 columns and 11 rows; its height is not
        // divisible by 11, so round row boundaries instead of losing pixels.
        const explodeTexture = this.textures.get('intro-explode');
        const source = explodeTexture.getSourceImage();
        const explodeFrames = [];
        for (let row = 0; row < 11; row += 1) {
            const top = Math.round(row * source.height / 11);
            const bottom = Math.round((row + 1) * source.height / 11);
            for (let column = 0; column < 5; column += 1) {
                const frame = String(row * 5 + column);
                if (!explodeTexture.has(frame)) {
                    explodeTexture.add(frame, 0, column * source.width / 5, top,
                        source.width / 5, bottom - top);
                }
                explodeFrames.push({ key: 'intro-explode', frame });
            }
        }
        if (!this.anims.exists('intro-reverse-explode')) {
            this.anims.create({
                key: 'intro-reverse-explode',
                frames: explodeFrames,
                frameRate: 30,
                repeat: 0
            });
        }

        if (!this.anims.exists('title-reveal')) {
            this.anims.create({
                key: 'title-reveal',
                frames: this.anims.generateFrameNumbers('title'),
                frameRate: 30,
                repeat: 0
            });
        }

        this.cameras.main.setBackgroundColor('#000000');
        // Match the 302 x 255 reference screen, centered at an integer scale.
        const scale = Math.min(this.scale.width / 302, this.scale.height / 255);
        const layoutScale = scale >= 1 ? Math.floor(scale) : scale;
        const left = (this.scale.width - 302 * layoutScale) / 2;
        const top = (this.scale.height - 255 * layoutScale) / 2;
        const placeImage = (key, x, y) => this.add.image(
            left + x * layoutScale, top + y * layoutScale, key
        ).setOrigin(0).setScale(layoutScale).setDepth(1);

        const titleColors = Object.values(DefenderPalette)
            .map(color => Number.parseInt(color.hex.slice(1), 16))
            .filter(color => color !== 0x000000);
        // Account for the title frame's black padding around the lettering.
        const titleScale = 91 / 187;
        const title = this.add.sprite(
            left + (109 - 14 * titleScale) * layoutScale,
            top + (60 - 13 * titleScale) * layoutScale, 'title', 0
        ).setOrigin(0).setScale(titleScale * layoutScale).setDepth(1);
        const cyclingImages = [];
        const tintImage = image => image.setTint(Phaser.Utils.Array.GetRandom(titleColors));
        const cycleColors = image => {
            cyclingImages.push(image);
            tintImage(image);
            return image;
        };

        cycleColors(title);
        this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => cyclingImages.forEach(tintImage)
        });
        title.once('animationcomplete-title-reveal', () => {
            cycleColors(placeImage('intro2-tint', 96, 84));
            // Align the final sheet frame's logo with intro3's reference position.
            // Keep the sheet's black padding behind the title and intro text.
            const explodeScale = 118 / 241;
            const explode = this.add.sprite(
                left + (97 - 278 * explodeScale) * layoutScale,
                top + (144 - 303 * explodeScale) * layoutScale,
                'intro-explode', '0'
            ).setOrigin(0).setScale(explodeScale * layoutScale);
            explode.once('animationcomplete-intro-reverse-explode', () => {
                explode.destroy();
                placeImage('intro3', 97, 144);
                cycleColors(placeImage('intro3-tint', 97, 144).setDepth(2));
                this.time.delayedCall(1000, () => {
                    cycleColors(placeImage('intro4-tint', 118, 208));
                });
            });
            explode.play('intro-reverse-explode');
        });
        title.play('title-reveal');
        this.time.delayedCall(20000, () => this.scene.start('DemoScene'));

        this.add.text(this.scale.width / 2, top + 237 * layoutScale,
            'PRESS ANY KEY OR CLICK TO START', {
            fontFamily: 'monospace',
            fontSize: `${8 * layoutScale}px`,
            color: '#00ffff'
        }).setOrigin(0.5).setDepth(1);

        let startingGame = false;
        const startGame = () => {
            if (startingGame) return;
            startingGame = true;
            this.scene.start('GameScene');
        };
        this.input.keyboard.once('keydown', startGame);
        this.input.once('pointerdown', startGame);
        this.events.once('shutdown', () => {
            this.input.keyboard.off('keydown', startGame);
            this.input.off('pointerdown', startGame);
        });
    }

    createTintTexture(key, whiteOnly = false) {
        const tintKey = `${key}-tint`;
        if (this.textures.exists(tintKey)) return;

        const source = this.textures.get(key).getSourceImage();
        const texture = this.textures.createCanvas(tintKey, source.width, source.height);
        const context = texture.getContext();
        context.drawImage(source, 0, 0);
        const pixels = context.getImageData(0, 0, source.width, source.height);

        for (let i = 0; i < pixels.data.length; i += 4) {
            const [r, g, b] = pixels.data.subarray(i, i + 3);
            const selected = whiteOnly
                ? r >= 230 && g >= 230 && b >= 220
                : r + g + b > 0;
            if (selected) {
                pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
            } else {
                pixels.data[i + 3] = 0;
            }
        }

        context.putImageData(pixels, 0, 0);
        texture.refresh();
    }
}

