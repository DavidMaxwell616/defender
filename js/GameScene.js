import { DefenderPalette } from './config.js';
import LaserShot from './LaserShot.js';

export default class GameScene extends Phaser.Scene {
    constructor(key = 'GameScene') {
        super({ key });
    }

    preload() {
        this.load.atlas('defender-sprites-source',
            'assets/defendersprites.png', 'assets/defendersprites.json');
    }

    create({ wave = 1, score = 0, lives = 3, smartBombs = 3 } = {}) {
        this.smartBombs = smartBombs;
        this.lives = lives;
        this.wave = wave;
        this.startingScore = score;
        this.nextExtraShipScore = (Math.floor(score / 10000) + 1) * 10000;
        this.baiterDefeated = false;
        this.waveCompleted = false;
        this.gameOver = false;
        this.playerDying = false;
        this.playerProtectedUntil = 0;
        this.rescuedPassenger = null;
        this.cameras.main.setBackgroundColor('#000000');
        this.startSpriteColorCycle();
        if (!this.anims.exists('lander-idle')) {
            this.anims.create({
                key: 'lander-idle',
                frames: Array.from({ length: 6 }, (_, index) => ({
                    key: 'defender-sprites', frame: `lander-${index}`
                })),
                frameRate: 8,
                repeat: -1
            });
        }
        this.worldScroll = 0;
        if (!this.anims.exists('mutant-flight')) {
            this.anims.create({
                key: 'mutant-flight',
                frames: [0, 1].map(index => ({ key: 'defender-sprites', frame: `mutant-${index}` })),
                frameRate: 12,
                repeat: -1
            });
        }
        this.thrustVelocity = 0;
        if (!this.anims.exists('bomber-flight')) {
            this.anims.create({ key: 'bomber-flight',
                frames: ['14', '15', '16', '17', '18'].map(frame => ({ key: 'defender-sprites', frame })),
                frameRate: 10, repeat: -1 });
        }
        if (!this.anims.exists('pod-flight')) {
            this.anims.create({ key: 'pod-flight',
                frames: ['07', '08', '10', '12'].map(frame => ({ key: 'defender-sprites', frame })),
                frameRate: 10, repeat: -1 });
        }
        if (!this.anims.exists('baiter-flight')) {
            this.anims.create({
                key: 'baiter-flight',
                frames: ['75', '76', '77', '81', '82'].map(frame => ({
                    key: 'defender-sprites', frame
                })),
                frameRate: 14,
                repeat: -1
            });
        }
        this.createStars();
        this.createTerrain();
        this.createPeople();
        this.createHUD();
        this.player = this.add.sprite(this.scale.width / 2, this.scale.height / 2,
            'defender-sprites', 'hud-ship').setDepth(20);
        this.facing = 1;
        this.exhaust = this.add.graphics().setDepth(19);
        this.exhaustDots = [];
        this.exhaustElapsed = 0;
        this.exhaustColors = Object.values(DefenderPalette)
            .map(color => Number.parseInt(color.hex.slice(1), 16))
            .filter(color => color !== 0);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.smartBombKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.shots = [];
        this.nextShotAt = 0;
        this.enemies = [];
        this.explosions = [];
        this.bombs = [];
        this.scheduleEnemyWaves();
        this.events.once('shutdown', () => {
            this.shots.forEach(shot => shot.destroy());
            this.shots = [];
        });
    }

    scheduleEnemyWaves() {
        const extra = Math.max(0, this.wave - 2);
        this.aggression = 1 + extra * 0.15;
        this.pendingSpawns = 0;
        const schedule = (delay, count, frame, type) => {
            this.pendingSpawns += count;
            for (let i = 0; i < count; i += 1) {
                this.time.delayedCall(delay + i * 500, () => {
                    this.pendingSpawns -= 1;
                    this.spawnEnemy(this.worldScroll + this.scale.width * (i + 1) / (count + 1),
                        this.scale.height * (0.25 + (i % 3) * 0.08), frame, type);
                });
            }
        };
        for (const delay of [500, 12000]) {
            schedule(delay, 3 + extra, 'lander-0', 'lander');
            if (this.wave >= 2) schedule(delay + 2500, 2 + extra, '07', 'pod');
        }
        if (this.wave >= 2) schedule(24000, 3 + extra, '14', 'bomber');
        schedule(this.wave >= 2 ? 32000 : 24000, 1 + Math.floor(extra / 2), '75', 'baiter');
    }

    update(time, delta) {
        if (!this.player || this.waveCompleted || this.gameOver || this.playerDying) return;
        const horizontal = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const vertical = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
        const seconds = delta / 1000;
        const diagonalScale = horizontal && vertical ? Math.SQRT2 : 1;
        const speed = 420 / diagonalScale;
        const distance = 280 * seconds / diagonalScale;
        let scrollDelta;
        if (horizontal) {
            this.thrustVelocity = horizontal * speed;
            scrollDelta = this.thrustVelocity * seconds;
        } else {
            // Exponential drag gives the same gentle coast at any frame rate.
            const drag = 2.5;
            const decay = Math.exp(-drag * seconds);
            scrollDelta = this.thrustVelocity * (1 - decay) / drag;
            this.thrustVelocity *= decay;
            if (Math.abs(this.thrustVelocity) < 2) this.thrustVelocity = 0;
        }
        this.player.x = this.scale.width / 2;
        this.worldScroll += scrollDelta;
        this.terrain.x = -Phaser.Math.Wrap(this.worldScroll, 0, this.scale.width * 2);
        if (scrollDelta !== 0) this.drawRadarTerrain();
        this.drawStars();
        this.updateEnemies(Math.min(delta, 100) / 1000);
        this.updateBombs(Math.min(delta, 100) / 1000);
        this.updateFallingPeople(Math.min(delta, 100) / 1000);
        if (this.people.every(person => person.state === 'dead' || person.state === 'abducted')) {
            this.gameOver = true;
            this.scene.start('GameOverScene', { score: this.score });
            return;
        }
        for (const effect of this.explosions) {
            effect.graphics.x = this.worldToScreenX(effect.worldX);
        }
        for (const person of this.people) {
            person.sprite.x = Phaser.Math.Wrap(
                person.worldX - this.worldScroll + this.scale.width / 2,
                0, this.scale.width * 2
            ) - this.scale.width / 2;
        }
        for (const enemy of this.enemies) {
            enemy.container.x = Phaser.Math.Wrap(
                enemy.worldX - this.worldScroll + this.scale.width / 2,
                0, this.scale.width * 2
            ) - this.scale.width / 2;
        }
        // Existing projectiles and exhaust remain in the scrolling world.
        this.shots.forEach(shot => { shot.x -= scrollDelta; });
        this.exhaustDots.forEach(dot => { dot.x -= scrollDelta; });
        this.player.y = Phaser.Math.Clamp(this.player.y + vertical * distance,
            this.scale.height * 124 / 772 + 18, this.scale.height - 32);
        if (horizontal) {
            this.facing = horizontal;
            this.player.setFlipX(horizontal < 0);
        }
        this.updateRescue();
        if (Phaser.Input.Keyboard.JustDown(this.smartBombKey)) this.useSmartBomb();
        this.updateExhaust(delta, horizontal !== 0);
        this.drawRadarActors();
        if (this.fireKey.isDown || this.input.activePointer.leftButtonDown()) {
            this.fireLaser(time);
        }
        this.shots = this.shots.filter(shot => {
            const previousX = shot.x;
            const onScreen = shot.update(delta);
            // Sweep the leading beam between frames so fast shots cannot skip enemies.
            const tailX = previousX - shot.direction * Math.min(116, shot.distance);
            const left = Math.min(tailX, shot.x);
            const right = Math.max(tailX, shot.x);
            const hits = this.enemies.filter(enemy => {
                if (enemy.spawning || !enemy.container.active) return false;
                const bounds = enemy.sprite.getBounds();
                return right >= bounds.left && left <= bounds.right
                    && shot.y + 2 >= bounds.top && shot.y - 2 <= bounds.bottom;
            }).map(enemy => ({ x: enemy.container.x, enemy }));
            for (const bomb of this.bombs) {
                if (right >= bomb.graphics.x - 4 && left <= bomb.graphics.x + 4
                    && Math.abs(shot.y - bomb.y) <= 6) {
                    hits.push({ x: bomb.graphics.x, bomb });
                }
            }
            hits.sort((a, b) => shot.direction * (a.x - b.x));
            if (hits.length) {
                if (hits[0].enemy) this.destroyEnemy(hits[0].enemy);
                else {
                    const bomb = hits[0].bomb;
                    this.explodeAt(bomb.worldX, bomb.y, bomb.color);
                    bomb.graphics.destroy();
                    this.bombs = this.bombs.filter(candidate => candidate !== bomb);
                }
            }
            if (onScreen && !hits.length) return true;
            shot.destroy();
            return false;
        });
        this.drawRadarActors();
        this.checkPlayerHits();
    }

    checkPlayerHits() {
        if (this.playerDying || this.waveCompleted || this.time.now < this.playerProtectedUntil) return;
        const bounds = this.player.getBounds();
        // Ignore transparent padding around the ship frame.
        const hitbox = new Phaser.Geom.Rectangle(bounds.x + 8, bounds.y + 8,
            bounds.width - 16, bounds.height - 16);
        const enemyHit = this.enemies.some(enemy => !enemy.spawning && enemy.sprite.active
            && Phaser.Geom.Intersects.RectangleToRectangle(hitbox, enemy.sprite.getBounds()));
        const bomb = this.bombs.find(candidate => Phaser.Geom.Intersects.RectangleToRectangle(
            hitbox, new Phaser.Geom.Rectangle(candidate.graphics.x - 3, candidate.y - 3, 6, 6)));
        if (!enemyHit && !bomb) return;
        if (bomb) {
            bomb.graphics.destroy();
            this.bombs = this.bombs.filter(candidate => candidate !== bomb);
        }
        this.playerDying = true;
        this.lives = Math.max(0, this.lives - 1);
        this.drawLives();
        this.thrustVelocity = 0;
        this.exhaust.clear();
        this.exhaustDots = [];
        if (this.rescuedPassenger) {
            const person = this.rescuedPassenger;
            person.state = 'falling';
            person.fallStartY = person.sprite.y;
            person.fallSpeed = 0;
            this.rescuedPassenger = null;
        }
        this.player.setTintFill(0xffffff);
        let flash = 0;
        this.time.addEvent({ delay: 90, repeat: 6, callback: () => {
            flash += 1;
            if (flash === 7) {
                this.player.setVisible(false).clearTint();
                this.explodePlayer();
            } else if (flash % 2) this.player.clearTint();
            else this.player.setTintFill(0xffffff);
        } });
    }

    explodePlayer() {
        const graphics = this.add.graphics().setPosition(this.player.x, this.player.y).setDepth(120);
        const colors = [0xffffff, 0xffff00, 0xff8000, 0xff0000, 0x8000ff];
        const particles = Array.from({ length: 100 }, () => {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const radius = Phaser.Math.Between(70, 190);
            return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
                size: Phaser.Math.Between(2, 6) };
        });
        const draw = progress => {
            const phase = Math.min(3, Math.floor(progress * 4));
            const blend = progress * 4 - phase;
            const start = colors[phase];
            const end = colors[phase + 1];
            const channel = shift => Math.round(((start >> shift) & 255) * (1 - blend)
                + ((end >> shift) & 255) * blend);
            const color = (channel(16) << 16) | (channel(8) << 8) | channel(0);
            const radius = 1 - Math.pow(1 - progress, 2);
            graphics.clear().fillStyle(color, 1 - progress);
            particles.forEach(dot => graphics.fillRect(Math.round(dot.x * radius),
                Math.round(dot.y * radius), dot.size, dot.size));
        };
        draw(0);
        this.tweens.addCounter({ from: 0, to: 1, duration: 1500,
            onUpdate: tween => draw(tween.getValue()),
            onComplete: () => {
                graphics.destroy();
                if (this.lives === 0) {
                    this.gameOver = true;
                    this.scene.start('GameOverScene', { score: this.score });
                    return;
                }
                this.player.setPosition(this.scale.width / 2, this.scale.height / 2)
                    .setVisible(true).clearTint();
                this.playerProtectedUntil = this.time.now + 2000;
                this.playerDying = false;
                this.respawnBaiters();
            }
        });
    }

    respawnBaiters() {
        const baiters = this.enemies.filter(enemy => enemy.type === 'baiter');
        const count = Math.max(1, baiters.length);
        // Replace existing pursuers without awarding kill points or completing a wave.
        baiters.forEach(enemy => enemy.container.destroy());
        this.enemies = this.enemies.filter(enemy => enemy.type !== 'baiter');
        this.baiterDefeated = false;
        for (let index = 0; index < count; index += 1) {
            const side = index % 2 === 0 ? 0.9 : 0.1;
            this.spawnEnemy(this.worldScroll + this.scale.width * side,
                this.scale.height * (0.25 + (index % 3) * 0.1), '75', 'baiter');
        }
    }

    fireLanderBomb(enemy) {
        const dx = Phaser.Math.Wrap(this.worldScroll + this.player.x - enemy.worldX,
            -this.scale.width, this.scale.width);
        const dy = this.player.y - enemy.container.y;
        const distance = Math.hypot(dx, dy) || 1;
        this.bombs.push({
            worldX: enemy.worldX, y: enemy.container.y,
            vx: enemy.type === 'bomber' ? 0 : dx / distance * 180 * this.aggression,
            vy: enemy.type === 'bomber' ? 110 * this.aggression : dy / distance * 180 * this.aggression,
            life: 6, colorTime: 0, color: 0xffffff,
            graphics: this.add.graphics().setDepth(16)
        });
    }

    updateBombs(seconds) {
        this.bombs = this.bombs.filter(bomb => {
            bomb.life -= seconds;
            bomb.worldX = Phaser.Math.Wrap(bomb.worldX + bomb.vx * seconds, 0, this.scale.width * 2);
            bomb.y += bomb.vy * seconds;
            if (bomb.life <= 0 || bomb.y < this.scale.height * 124 / 772
                || bomb.y >= this.getGroundHeight(bomb.worldX)) {
                bomb.graphics.destroy();
                return false;
            }
            bomb.colorTime -= seconds;
            if (bomb.colorTime <= 0) {
                bomb.color = Phaser.Utils.Array.GetRandom(this.exhaustColors);
                bomb.colorTime = 0.075;
            }
            bomb.graphics.clear().setPosition(this.worldToScreenX(bomb.worldX), bomb.y);
            bomb.graphics.fillStyle(bomb.color, 0.25).fillCircle(0, 0, 5);
            bomb.graphics.fillStyle(bomb.color).fillRect(-3, -3, 6, 6);
            return true;
        });
    }

    worldToScreenX(worldX) {
        const width = this.scale.width;
        return Phaser.Math.Wrap(worldX - this.worldScroll + width / 2, 0, width * 2) - width / 2;
    }

    useSmartBomb() {
        if (this.smartBombs <= 0 || this.playerDying || this.waveCompleted || this.gameOver) return;
        this.smartBombs -= 1;
        this.drawSmartBombs();
        const top = this.scale.height * 124 / 772;
        const area = new Phaser.Geom.Rectangle(0, top, this.scale.width, this.scale.height - top);
        const flash = this.add.rectangle(0, top, area.width, area.height, 0xffffff)
            .setOrigin(0).setDepth(24);
        this.tweens.add({ targets: flash, alpha: 0, duration: 250,
            onComplete: () => flash.destroy() });
        // Resolve the baiter last so completion includes all kills and dropped humans.
        const targets = this.enemies.filter(enemy => enemy.container.active
            && Phaser.Geom.Intersects.RectangleToRectangle(area, enemy.sprite.getBounds()))
            .sort((a, b) => Number(a.type === 'baiter') - Number(b.type === 'baiter'));
        targets.forEach(enemy => this.destroyEnemy(enemy, true));
        this.bombs = this.bombs.filter(bomb => {
            if (!area.contains(bomb.graphics.x, bomb.y)) return true;
            this.explodeAt(bomb.worldX, bomb.y, bomb.color);
            bomb.graphics.destroy();
            return false;
        });
    }

    destroyEnemy(enemy, smartBomb = false) {
        this.setScore(this.score + (enemy.type === 'pod' ? 1000 : enemy.type === 'bomber' ? 250
            : enemy.type === 'baiter' ? 200 : 150));
        if (enemy.type === 'pod' && !smartBomb) this.releaseSwarmers(enemy);
        if (enemy.type === 'baiter') this.baiterDefeated = true;
        if (enemy.carrying) {
            const person = enemy.carrying;
            person.state = 'falling';
            person.claimedBy = null;
            person.fallStartY = person.sprite.y;
            person.fallSpeed = 0;
            enemy.carrying = null;
        }
        if (enemy.target?.claimedBy === enemy) enemy.target.claimedBy = null;
        this.explodeAt(enemy.worldX, enemy.container.y);
        enemy.container.destroy();
        this.enemies = this.enemies.filter(candidate => candidate !== enemy);
        if (this.baiterDefeated && this.pendingSpawns === 0
            && (this.wave === 1 || this.enemies.length === 0) && !this.waveCompleted) {
            this.waveCompleted = true;
            const survivors = this.people.filter(person => person.sprite.active
                && person.state !== 'dead' && person.state !== 'abducted').length;
            this.setScore(this.score + survivors * 100);
            // Finish the current collision pass before shutting down the game scene.
            this.time.delayedCall(0, () => this.scene.start('WaveCompleteScene', {
                score: this.score, survivors, wave: this.wave, lives: this.lives,
                smartBombs: this.smartBombs
            }));
        }
    }

    releaseSwarmers(pod) {
        for (let index = 0; index < 8; index += 1) {
            const angle = index * Math.PI / 4;
            const sprite = this.add.sprite(0, 0, 'defender-sprites', '40');
            const worldX = pod.worldX + Math.cos(angle) * 12;
            const container = this.add.container(this.worldToScreenX(worldX),
                pod.container.y + Math.sin(angle) * 12, [sprite]).setDepth(15);
            this.enemies.push({ worldX, container, sprite, type: 'swarmer', spawning: false,
                angle, age: 0, vx: Math.cos(angle) * 180, vy: Math.sin(angle) * 180 });
        }
    }

    updateRescue() {
        if (!this.rescuedPassenger) {
            const shipBounds = this.player.getBounds();
            const person = this.people.find(candidate => candidate.state === 'falling'
                && Phaser.Geom.Intersects.RectangleToRectangle(shipBounds, candidate.sprite.getBounds()));
            if (person) {
                person.state = 'rescued';
                person.claimedBy = null;
                this.rescuedPassenger = person;
                this.setScore(this.score + 500);
                const popup = this.add.image(this.player.x, this.player.y - 26,
                    'defender-sprites', 'score-500').setDepth(110);
                this.tweens.add({ targets: popup, y: popup.y - 32, alpha: 0,
                    duration: 1200, onComplete: () => popup.destroy() });
            }
        }
        const person = this.rescuedPassenger;
        if (!person) return;
        person.worldX = Phaser.Math.Wrap(this.worldScroll + this.player.x, 0, this.scale.width * 2);
        person.sprite.x = this.player.x;
        const groundY = this.getGroundHeight(person.worldX);
        person.sprite.y = Math.min(groundY, this.player.y + 12 + person.sprite.displayHeight);
        if (person.sprite.y >= groundY) {
            person.state = 'grounded';
            this.rescuedPassenger = null;
        }
    }

    updateFallingPeople(seconds) {
        for (const person of this.people) {
            if (person.state !== 'falling') continue;
            const groundY = this.getGroundHeight(person.worldX);
            person.fallSpeed += 240 * seconds;
            person.sprite.y = Math.min(groundY, person.sprite.y + person.fallSpeed * seconds);
            if (person.sprite.y < groundY) continue;
            if (groundY - person.fallStartY > 100) {
                person.state = 'dead';
                person.sprite.setVisible(false).setActive(false);
                this.explodeAt(person.worldX, groundY,
                    Number.parseInt(DefenderPalette.HUMAN_MAGENTA.hex.slice(1), 16));
            } else {
                person.state = 'grounded';
            }
        }
    }

    explodeAt(worldX, y, color = 0x00ff00) {
        const graphics = this.add.graphics().setPosition(this.worldToScreenX(worldX), y).setDepth(25);
        const effect = { worldX, graphics };
        this.explosions.push(effect);
        const dots = Array.from({ length: 48 }, () => {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const radius = Phaser.Math.Between(45, 95);
            return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
                size: Phaser.Math.Between(1, 3) };
        });
        const draw = progress => {
            graphics.clear().fillStyle(color, 1 - progress * 0.8);
            dots.forEach(dot => graphics.fillRect(Math.round(dot.x * progress),
                Math.round(dot.y * progress), dot.size, dot.size));
        };
        draw(0);
        this.tweens.addCounter({
            from: 0, to: 1, duration: 800, ease: 'Quad.easeOut',
            onUpdate: tween => draw(tween.getValue()),
            onComplete: () => {
                graphics.destroy();
                this.explosions = this.explosions.filter(candidate => candidate !== effect);
            }
        });
    }

    spawnEnemy(worldX, y, frame = 'lander-0', type = 'lander') {
        const sprite = this.add.sprite(0, 0, 'defender-sprites', frame)
            .setVisible(false).setActive(false);
        const particles = this.add.graphics();
        const container = this.add.container(worldX - this.worldScroll, y, [sprite, particles])
            .setDepth(15);
        const enemy = { worldX, container, sprite, spawning: true,
            type, target: null, carrying: null, steeringTime: 0, vx: 0, vy: 0 };
        this.enemies.push(enemy);

        const green = Number.parseInt(DefenderPalette.LANDER_GREEN.hex.slice(1), 16);
        const dots = Array.from({ length: 48 }, () => {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const radius = Phaser.Math.Between(45, 95);
            return {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                size: Phaser.Math.Between(1, 3)
            };
        });
        const draw = progress => {
            particles.clear().fillStyle(green);
            for (const dot of dots) {
                particles.fillRect(Math.round(dot.x * (1 - progress)),
                    Math.round(dot.y * (1 - progress)), dot.size, dot.size);
            }
        };
        draw(0);
        const spawnTween = this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 800,
            ease: 'Quad.easeIn',
            onUpdate: tween => draw(tween.getValue()),
            onComplete: () => {
                particles.destroy();
                sprite.setVisible(true).setActive(true);
                if (frame.startsWith('lander-')) sprite.play('lander-idle');
                if (enemy.type === 'baiter') sprite.play('baiter-flight');
                if (enemy.type === 'pod') sprite.play('pod-flight');
                if (enemy.type === 'bomber') sprite.play('bomber-flight');
                enemy.spawning = false;
            }
        });
        container.once('destroy', () => spawnTween.remove());
        return enemy;
    }

    updateEnemies(seconds) {
        const elapsed = seconds;
        const width = this.scale.width;
        const top = this.scale.height * 124 / 772 + 18;
        const wrapDistance = (from, to) => Phaser.Math.Wrap(to - from, -width, width);
        const approach = (value, target, step) => value + Phaser.Math.Clamp(target - value, -step, step);
        for (const enemy of this.enemies) {
            if (enemy.spawning || !enemy.container.active) continue;
            // Keep pursuers below even the player's 280 px/s vertical speed.
            const speedScale = enemy.type === 'baiter' || enemy.type === 'swarmer'
                ? Math.min(this.aggression, 1.1) : this.aggression;
            seconds = elapsed * speedScale;
            if (enemy.type === 'lander' || enemy.type === 'bomber') {
                enemy.bombCooldown = (enemy.bombCooldown ?? Phaser.Math.FloatBetween(2, 4)) - seconds;
                if (enemy.bombCooldown <= 0) {
                    const screenX = this.worldToScreenX(enemy.worldX);
                    if (screenX >= 0 && screenX <= width) this.fireLanderBomb(enemy);
                    enemy.bombCooldown = enemy.type === 'bomber'
                        ? Phaser.Math.FloatBetween(1, 2) : Phaser.Math.FloatBetween(3, 5);
                }
            }
            if (enemy.type === 'swarmer') {
                enemy.age += seconds;
                // Burst outward first, then encircle and periodically dive inward.
                if (enemy.age > 0.35) {
                    const angle = enemy.angle + enemy.age * 0.8;
                    const radius = 20 + 65 * (0.5 + 0.5 * Math.sin(enemy.age * 2 + enemy.angle));
                    const dx = wrapDistance(enemy.worldX,
                        this.worldScroll + this.player.x + Math.cos(angle) * radius);
                    const dy = this.player.y + Math.sin(angle) * radius - enemy.container.y;
                    const distance = Math.hypot(dx, dy) || 1;
                    const speed = Math.min(220, distance * 5);
                    enemy.vx = approach(enemy.vx, dx / distance * speed, 1000 * seconds);
                    enemy.vy = approach(enemy.vy, dy / distance * speed, 1000 * seconds);
                }
                enemy.worldX += enemy.vx * seconds;
                enemy.container.y = Phaser.Math.Clamp(enemy.container.y + enemy.vy * seconds,
                    top, this.scale.height - 24);
            } else if (enemy.type === 'bomber') {
                enemy.steeringTime += seconds;
                enemy.worldX += 95 * seconds;
                enemy.container.y = this.scale.height * (0.35 + 0.12 * Math.sin(enemy.steeringTime));
            } else if (enemy.type === 'pod') {
                enemy.steeringTime += seconds;
                enemy.worldX += 35 * seconds;
                enemy.container.y += Math.sin(enemy.steeringTime * 2) * 20 * seconds;
            } else if (enemy.type === 'baiter') {
                const dx = wrapDistance(enemy.worldX, this.worldScroll + this.player.x);
                const dy = this.player.y - enemy.container.y;
                const distance = Math.hypot(dx, dy);
                // Continuous steering and strong acceleration make the baiter relentless.
                const speed = Math.min(240, distance * 8);
                const divisor = distance || 1;
                enemy.vx = approach(enemy.vx, dx / divisor * speed, 1800 * seconds);
                enemy.vy = approach(enemy.vy, dy / divisor * speed, 1800 * seconds);
                enemy.worldX += enemy.vx * seconds;
                enemy.container.y = Phaser.Math.Clamp(enemy.container.y + enemy.vy * seconds,
                    top, this.scale.height - 24);
            } else if (enemy.type === 'mutant') {
                enemy.steeringTime -= seconds;
                if (enemy.steeringTime <= 0) {
                    const dx = wrapDistance(enemy.worldX, this.worldScroll + this.player.x);
                    const dy = this.player.y - enemy.container.y;
                    const angle = Math.atan2(dy, dx) + Phaser.Math.FloatBetween(-0.8, 0.8);
                    const speed = Phaser.Math.Between(190, 330);
                    enemy.vx = Math.cos(angle) * speed;
                    enemy.vy = Math.sin(angle) * speed;
                    enemy.steeringTime = Phaser.Math.FloatBetween(0.12, 0.35);
                }
                enemy.worldX += enemy.vx * seconds;
                enemy.container.y = Phaser.Math.Clamp(enemy.container.y + enemy.vy * seconds,
                    top, this.scale.height - 24);
            } else if (enemy.carrying) {
                enemy.container.y = Math.max(top, enemy.container.y - 65 * seconds);
                const person = enemy.carrying;
                person.worldX = enemy.worldX;
                person.sprite.y = enemy.container.y + 16 + person.sprite.displayHeight;
                if (enemy.container.y <= top) {
                    person.state = 'abducted';
                    person.claimedBy = null;
                    person.sprite.setVisible(false).setActive(false);
                    enemy.carrying = null;
                    enemy.target = null;
                    enemy.type = 'mutant';
                    enemy.sprite.play('mutant-flight');
                }
            } else {
                if (!enemy.target || enemy.target.state !== 'grounded') {
                    if (enemy.target?.claimedBy === enemy) enemy.target.claimedBy = null;
                    enemy.target = this.people.filter(person => person.state === 'grounded' && !person.claimedBy)
                        .sort((a, b) => Math.abs(wrapDistance(enemy.worldX, a.worldX))
                            - Math.abs(wrapDistance(enemy.worldX, b.worldX)))[0] || null;
                    if (enemy.target) enemy.target.claimedBy = enemy;
                }
                if (!enemy.target) continue;
                const person = enemy.target;
                const dx = wrapDistance(enemy.worldX, person.worldX);
                enemy.worldX += Phaser.Math.Clamp(dx, -75 * seconds, 75 * seconds);
                // Descend only after lining up over the target.
                if (Math.abs(dx) < 12) {
                    const pickupY = person.sprite.y - person.sprite.displayHeight - 16;
                    enemy.container.y = approach(enemy.container.y, pickupY, 55 * seconds);
                    if (Math.abs(enemy.container.y - pickupY) < 1 && Math.abs(dx) < 3) {
                        enemy.worldX = person.worldX;
                        person.state = 'carried';
                        enemy.carrying = person;
                    }
                }
            }
            enemy.worldX = Phaser.Math.Wrap(enemy.worldX, 0, width * 2);
        }
    }

    updateExhaust(delta, thrusting) {
        const elapsed = Math.min(delta, 100);
        const seconds = elapsed / 1000;
        this.exhaustDots = this.exhaustDots.filter(dot => {
            dot.life -= elapsed;
            dot.x += dot.vx * seconds;
            dot.y += dot.vy * seconds;
            return dot.life > 0;
        });

        // A faint idle sputter becomes a denser, longer plume under thrust.
        const interval = thrusting ? 12 : 70;
        this.exhaustElapsed += elapsed;
        while (this.exhaustElapsed >= interval) {
            this.exhaustElapsed -= interval;
            const life = Phaser.Math.Between(thrusting ? 200 : 100, thrusting ? 420 : 220);
            this.exhaustDots.push({
                x: this.player.x - this.facing * 27,
                y: this.player.y + 4 + Phaser.Math.Between(-3, 3),
                vx: -this.facing * Phaser.Math.Between(thrusting ? 100 : 25, thrusting ? 220 : 65),
                vy: Phaser.Math.Between(-25, 25),
                life,
                maxLife: life,
                size: Phaser.Math.Between(1, thrusting ? 3 : 2),
                color: Phaser.Utils.Array.GetRandom(this.exhaustColors)
            });
        }

        this.exhaust.clear();
        for (const dot of this.exhaustDots) {
            this.exhaust.fillStyle(dot.color, dot.life / dot.maxLife)
                .fillRect(Math.round(dot.x), Math.round(dot.y), dot.size, dot.size);
        }
    }

    fireLaser(time = this.time.now) {
        if (time < this.nextShotAt) return;
        this.nextShotAt = time + 160;
        this.shots.push(new LaserShot(this,
            this.player.x + this.facing * 29, this.player.y + 4, this.facing));
    }

    startSpriteColorCycle() {
        const sourceTexture = this.textures.get('defender-sprites-source');
        const source = sourceTexture.getSourceImage();
        // Keep the original atlas immutable; all displayed frames share this canvas.
        const texture = this.textures.exists('defender-sprites')
            ? this.textures.get('defender-sprites')
            : this.textures.createCanvas('defender-sprites', source.width, source.height);
        for (const name of sourceTexture.getFrameNames()) {
            if (!texture.has(name)) {
                const frame = sourceTexture.get(name);
                texture.add(name, 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
            }
        }

        const context = texture.getContext();
        context.clearRect(0, 0, source.width, source.height);
        context.drawImage(source, 0, 0);
        const pixels = context.getImageData(0, 0, source.width, source.height);
        const whitePixels = [];
        for (let i = 0; i < pixels.data.length; i += 4) {
            if (pixels.data[i + 3] > 0 && pixels.data[i] === 255
                && pixels.data[i + 1] === 255 && pixels.data[i + 2] === 255) {
                whitePixels.push(i);
            }
        }
        const colors = Object.values(DefenderPalette)
            .map(color => Number.parseInt(color.hex.slice(1), 16))
            .filter(color => color !== 0);
        const cycle = () => {
            const color = Phaser.Utils.Array.GetRandom(colors);
            for (const i of whitePixels) {
                pixels.data[i] = (color >> 16) & 255;
                pixels.data[i + 1] = (color >> 8) & 255;
                pixels.data[i + 2] = color & 255;
            }
            context.putImageData(pixels, 0, 0);
            texture.refresh();
        };
        cycle();
        this.time.addEvent({ delay: 100, loop: true, callback: cycle });
    }

    createHUD() {
        // Use the reference frame's coordinates so the HUD scales with the terrain.
        this.hud = this.add.container(0, 0)
            .setScale(this.scale.width / 1058, this.scale.height / 772)
            .setScrollFactor(0).setDepth(100);
        const graphics = this.add.graphics();
        this.hud.add(graphics);
        graphics.fillStyle(0x000000).fillRect(0, 0, 1058, 124);
        graphics.lineStyle(4, 0x3500a0);
        graphics.strokeRect(317, 9, 461, 110);
        graphics.lineBetween(18, 119, 1052, 119);

        this.hud.add(this.add.image(86, 48, 'defender-sprites', 'hud-ship')
            .setOrigin(0).setScale(0.6));

        this.livesGraphics = this.add.graphics();
        this.hud.add(this.livesGraphics);
        this.drawLives();

        this.smartBombGraphics = this.add.graphics();
        this.hud.add(this.smartBombGraphics);
        this.drawSmartBombs();

        this.radarTerrain = this.add.graphics();
        this.hud.add(this.radarTerrain);
        this.drawRadarTerrain();

        this.radarActors = this.add.graphics();
        this.hud.add(this.radarActors);
        // White brackets mark the player's visible section of the world.
        graphics.lineStyle(4, 0xffffff);
        graphics.beginPath();
        graphics.moveTo(521, 20);
        graphics.lineTo(521, 11);
        graphics.lineTo(574, 11);
        graphics.lineTo(574, 20);
        graphics.moveTo(521, 110);
        graphics.lineTo(521, 119);
        graphics.lineTo(574, 119);
        graphics.lineTo(574, 110);
        graphics.strokePath();

        this.scoreGraphics = this.add.graphics();
        this.hud.add(this.scoreGraphics);
        this.setScore(this.startingScore);
    }

    drawSmartBombs() {
        const graphics = this.smartBombGraphics;
        graphics.clear().fillStyle(0x00ffff);
        for (let index = 0; index < this.smartBombs; index += 1) {
            const x = 150 + index * 24;
            graphics.fillRect(x, 51, 4, 16);
            graphics.fillRect(x - 6, 57, 16, 4);
        }
    }

    drawLives() {
        const graphics = this.livesGraphics;
        graphics.clear().fillStyle(0xffffff);
        for (let index = 0; index < this.lives; index += 1) {
            const y = 74 + index * 14;
            graphics.fillRect(273, y, 4, 3);
            graphics.fillRect(277, y + 3, 10, 3);
            graphics.fillRect(273, y + 6, 4, 3);
            graphics.fillRect(283, y - 1, 5, 3);
        }
    }

    drawRadarActors() {
        const graphics = this.radarActors;
        const width = this.scale.width;
        const centerWorldX = this.worldScroll + width / 2;
        graphics.clear();
        const humanColor = Number.parseInt(DefenderPalette.HUMAN_MAGENTA.hex.slice(1), 16);
        for (const person of this.people) {
            if (!person.sprite.active || !person.sprite.visible) continue;
            const relativeX = Phaser.Math.Wrap(person.worldX - centerWorldX, -width, width);
            const x = Math.round(547.5 + relativeX * 53 / width);
            const y = Math.round(12 + person.sprite.y / this.scale.height * 102);
            graphics.fillStyle(humanColor).fillRect(x - 1, y - 3, 3, 3);
        }
        for (const enemy of this.enemies) {
            if (!enemy.container.active || enemy.spawning || !enemy.sprite.visible) continue;
            // Use the same world scale as the terrain and wrap at the world seam.
            const relativeX = Phaser.Math.Wrap(enemy.worldX - centerWorldX,
                -width, width);
            const x = Math.round(547.5 + relativeX * 53 / width);
            const y = Math.round(12 + enemy.container.y / this.scale.height * 102);
            if (x < 325 || x > 770 || y < 14 || y > 112) continue;
            graphics.fillStyle(enemy.type === 'baiter' ? 0xffb000
                : enemy.type === 'bomber' ? 0xffff00
                : enemy.type === 'pod' ? 0xff8000 : enemy.type === 'swarmer' ? 0xff0000
                : enemy.type === 'mutant' ? 0xff00ff : 0x00ff00)
                .fillRect(x - 2, y - 2, 4, 4);
        }
        const playerY = Math.round(12 + this.player.y / this.scale.height * 102);
        graphics.fillStyle(0xffffff).fillRect(546, playerY - 2, 4, 4);
    }

    drawRadarTerrain() {
        const width = this.scale.width;
        const graphics = this.radarTerrain;
        graphics.clear().lineStyle(2, 0xa06030);
        graphics.beginPath();
        for (let radarX = 323; radarX <= 772; radarX += 1) {
            // The 53-pixel bracket spans exactly one screen of world terrain.
            const worldX = this.worldScroll + width / 2 + (radarX - 547.5) * width / 53;
            const terrainY = this.getGroundHeight(worldX);
            const radarY = 12 + terrainY / this.scale.height * 102;
            if (radarX === 323) graphics.moveTo(radarX, radarY);
            else graphics.lineTo(radarX, radarY);
        }
        graphics.strokePath();
    }

    setScore(score) {
        this.score = Math.max(0, Math.floor(score));
        if (this.score >= this.nextExtraShipScore) {
            const awards = Math.floor((this.score - this.nextExtraShipScore) / 10000) + 1;
            this.lives += awards;
            this.smartBombs += awards;
            this.nextExtraShipScore += awards * 10000;
            this.drawLives();
            this.drawSmartBombs();
        }
        const digits = [
            ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
            ['00110', '01110', '00110', '00110', '00110', '00110', '11111'],
            ['11110', '00011', '00011', '00110', '01100', '11000', '11111'],
            ['11110', '00011', '00011', '01110', '00011', '00011', '11110'],
            ['00110', '01110', '11010', '11010', '11111', '00010', '00010'],
            ['11111', '11000', '11000', '11110', '00011', '00011', '11110'],
            ['01110', '11000', '11000', '11110', '11011', '11011', '01110'],
            ['11111', '00011', '00110', '00110', '01100', '01100', '01100'],
            ['01110', '11011', '11011', '01110', '11011', '11011', '01110'],
            ['01110', '11011', '11011', '01111', '00011', '00011', '01110']
        ];
        const text = String(this.score);
        const pixelWidth = Math.min(4, 150 / (text.length * 7));
        const startX = 252 - (text.length * 7 - 2) * pixelWidth;
        this.scoreGraphics.clear().fillStyle(0xffc030);
        [...text].forEach((digit, index) => {
            digits[Number(digit)].forEach((row, y) => {
                [...row].forEach((pixel, x) => {
                    if (pixel === '1') this.scoreGraphics.fillRect(
                        startX + (index * 7 + x) * pixelWidth, 77 + y * 3,
                        pixelWidth, 3
                    );
                });
            });
        });
    }

    createStars() {
        const colors = Object.values(DefenderPalette)
            .map(color => Number.parseInt(color.hex.slice(1), 16))
            .filter(color => color !== 0);
        this.starGraphics = this.add.graphics().setDepth(-10);
        this.stars = Array.from({ length: 100 }, () => ({
            x: Phaser.Math.Between(0, this.scale.width - 1),
            y: Phaser.Math.Between(Math.ceil(this.scale.height * 124 / 772), this.scale.height - 1),
            color: Phaser.Utils.Array.GetRandom(colors)
        }));
        this.drawStars();
    }

    drawStars() {
        this.starGraphics.clear();
        for (const star of this.stars) {
            const x = Math.floor(Phaser.Math.Wrap(
                star.x - this.worldScroll * 0.2, 0, this.scale.width
            ));
            this.starGraphics.fillStyle(star.color).fillRect(x, star.y, 1, 1);
        }
    }

    getGroundHeight(worldX) {
        const width = this.scale.width;
        const wrappedX = Phaser.Math.Wrap(worldX, 0, width * 2);
        const localX = wrappedX <= width ? wrappedX : width * 2 - wrappedX;
        const points = this.terrainPoints;
        const rightIndex = points.findIndex(point => point.x >= localX);
        const right = points[Math.max(0, rightIndex)];
        const left = points[Math.max(0, rightIndex - 1)];
        const fraction = right.x === left.x ? 0 : (localX - left.x) / (right.x - left.x);
        return left.y + (right.y - left.y) * fraction;
    }

    createPeople() {
        const count = 10;
        const spacing = this.scale.width * 2 / count;
        this.people = Array.from({ length: count }, (_, index) => {
            // Randomize within separate regions to keep people from overlapping.
            const worldX = (index + Phaser.Math.FloatBetween(0.15, 0.85)) * spacing;
            const sprite = this.add.sprite(worldX, this.getGroundHeight(worldX),
                'defender-sprites', '13').setOrigin(0.5, 1).setScale(0.6).setDepth(5);
            return { worldX, sprite, state: 'grounded', claimedBy: null };
        });
    }

    createTerrain() {
        // Ridge landmarks from frame_00_delay-0.04s.gif (1058 x 772).
        const ridge = [
            [18, 713], [40, 694], [65, 715], [145, 715],
            [185, 749], [280, 661], [344, 718], [445, 718],
            [471, 694], [528, 745], [655, 628], [736, 704],
            [765, 677], [813, 721], [903, 721], [923, 738],
            [1052, 738]
        ];
        const scaleX = this.scale.width / (1052 - 18);
        const scaleY = this.scale.height / 772;
        const points = [];
        const addPoint = (x, y) => points.push({
            x: Math.round((x - 18) * scaleX),
            y: Math.round(y * scaleY)
        });

        ridge.forEach(([x, y], index) => {
            if (index > 0) {
                const [previousX, previousY] = ridge[index - 1];
                if (previousY === y) {
                    // Short teeth give the plateaus the reference's pixel texture.
                    for (let toothX = previousX + 4; toothX < x; toothX += 8) {
                        addPoint(toothX, y + 3);
                        addPoint(Math.min(toothX + 4, x), y);
                    }
                }
            }
            addPoint(x, y);
        });

        this.terrainPoints = points;
        this.terrain = this.add.graphics();
        // Mirrored neighbors join at identical heights for seamless scrolling.
        const width = this.scale.width;
        for (let tile = 0; tile < 3; tile += 1) {
            const ridge = tile % 2 === 0 ? points : [...points].reverse();
            const tilePoints = ridge.map(point => ({
                x: tile * width + (tile % 2 === 0 ? point.x : width - point.x),
                y: point.y
            }));
            this.terrain.fillStyle(0x000000);
            this.terrain.beginPath();
            this.terrain.moveTo(tilePoints[0].x, this.scale.height);
            tilePoints.forEach(point => this.terrain.lineTo(point.x, point.y));
            this.terrain.lineTo(tilePoints[tilePoints.length - 1].x, this.scale.height);
            this.terrain.closePath();
            this.terrain.fillPath();
            this.terrain.lineStyle(2, 0xa06030, 1);
            this.terrain.beginPath();
            this.terrain.moveTo(tilePoints[0].x, tilePoints[0].y);
            tilePoints.slice(1).forEach(point => this.terrain.lineTo(point.x, point.y));
            this.terrain.strokePath();
        }
    }
}
