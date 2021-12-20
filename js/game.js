var game = null;
const groundHeight = 148;
const ceilingHeight = 2;
const chunkSize = 400;
const hearticon = PIXI.Texture.from('img/heart.png');
const deg2rad = Math.PI / 180;
const bulletChunks = 5;
const chanceToSpawnCollectible = 25;
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const textStyle = new PIXI.TextStyle({
    fill: '#00FF00',
    fontFamily: 'Share Tech Mono',
    fontSize: 40
});


function onGameOpen() {
    game = {
        playing: false,
        graphics: null,
        currentGround: 0,
        currentCeiling: 148,
        firstFrame: true,
        app: null,
        speed: 0,
        score: 0,
        distance: 0,
        lastGeneratedChunk: -1,
        doubleJump: false,
        player: {
            position: [100, 0],
            size: [30, 30],
            lives: 3,
            jumpForce: 315,
            gravityForce: 940,
            velocity: 0,
        },
        bullets: [],
        chunks: [],
        elements: {
            score: $(".game #score")
        },
        getHighscore: () => {
            let hg = localStorage.getItem("highscore");
            return hg == null ? 0 : parseInt(hg);
        },
        setHighscore: (value) => {
            localStorage.setItem("highscore", value);
        },
        getAudio: () => {
            let hg = localStorage.getItem("audio");
            return hg == null ? true : hg == "true";
        },
        setAudio: (value) => {
            localStorage.setItem("audio", value);
            $(".audiobtn").html('<i class="fa ' + (value ? 'fa-volume-up' : 'fa-volume-off') + '"></i>');
        },

        sortCollection: (collection) => {
            var str = collection;
            str = str.split("");
            str = str.sort();
            return str.join("");
        },

        mustGenCollectible: () => {
            return true;
        },

        addToCollection: (item) => {
            s = game.sortCollection(item + game.getCollection());
            localStorage.setItem("collection", s);
        },

        getCollection: () => {
            let cl = localStorage.getItem("collection");
            return cl == null ? "" : cl;
        },

        getCollectibleToGen: () => {
            let c = game.getCollection();
            let newLetters = letters.split("").filter(x => !c.includes(x));

            return newLetters[Math.floor(Math.random() * newLetters.length)];
        }
    };

    //Update score & highscore
    game.elements.score.text(padNumber(game.score, 4));
    $(".highscore").text("HI " + padNumber(game.getHighscore(), 4));

    //Reload audio
    game.setAudio(game.getAudio());

    //Create lives 
    $("#lives").html('<img src="img/heart.png">'.repeat(game.player.lives));

    //Create view
    game.app = new PIXI.Application({ transparent: true, resizeTo: document.getElementById("gamecanvas"), width: $("#gamecanvas").width(), height: 150 });
    $("#gamecanvas").append(game.app.view);

    //On Game Start
    onGameStart();

    //Main Game Loop
    game.app.ticker.add((delta) => {
        const ms = delta / PIXI.settings.TARGET_FPMS;
        onGameUpdate(ms / 1000);
    });
}

function onGameStart() {
    let player = new PIXI.Graphics();
    player.lineStyle(4, 0xFFFFFF);
    player.drawRect(game.player.position[0], game.player.position[1] + groundHeight - game.player.size[0], game.player.size[0], game.player.size[1]);
    game.app.stage.addChild(player);

    game.graphics = { player: player };
}

function genWorldPiece(i, type = 0) {
    i = Math.max(game.lastGeneratedChunk + 1, i);
    let x = game.chunks.length == 0 ? 0 : game.chunks[game.chunks.length - 1].x + chunkSize;

    if (type == 4) {
        createWorldChunk(x, i * chunkSize, true, 3);
    }
    else
        createWorldChunk(x, i * chunkSize, type > 1 ? true : i < 1, type == 3 ? 2 : (type == 1 ? 1 : 0));

    game.lastGeneratedChunk = i;
}

function onGameUpdate(delta) {
    //#region Update

    //Update world pieces
    for (let i = Math.max(game.lastGeneratedChunk + 1, Math.floor(game.distance / chunkSize)); i < Math.ceil((game.distance + game.app.view.width) / chunkSize); i++) {
        genWorldPiece(i, i % 10 == 2 ? 1 : 0);
    }

    if (game.playing || game.firstFrame) {
        game.firstFrame = false;

        game.player.position[1] -= game.player.velocity * delta * game.speed * 1.02;
        game.player.velocity -= game.player.gravityForce * delta * game.speed * 1.02;
        game.player.position[0] += delta * game.speed * 300;

        if (game.player.position[1] > game.currentGround) {
            game.player.position[1] = game.currentGround;
            game.player.velocity = 0;
            game.doubleJump = true;
        }
        else if (-game.player.position[1] + game.player.size[0] > game.currentCeiling) {
            game.player.position[1] = game.player.size[0] - game.currentCeiling;
            game.player.velocity = 0;
        }

        game.graphics.player.y = game.player.position[1];

        //Update game variables
        game.distance += delta * game.speed * 300;

        if (game.speed < 1) {
            game.speed += delta / 2.5;
            if (game.speed > 1)
                game.speed = 1;
        }
        else
            game.speed += delta / 150;

        for (let i = 0; i < game.chunks.length; i++) {
            let chunk = game.chunks[i];
            if ((chunk.x -= delta * game.speed * 300) < -chunkSize) {
                game.app.stage.removeChild(chunk);
                game.chunks.splice(i, 1);
                i--;
            }

            for (let j = 0; j < chunk.bullets.length; j++) {
                let bullet = chunk.bullets[j];
                bullet.sprite.rotation += delta * 360 * Math.PI / 180;
                bullet.sprite.x -= delta * game.speed * 60;
                bullet.position[0] -= delta * game.speed * 60;

                if (intersection(bullet, game.player)) {

                    game.player.lives--;
                    playEffect('damage');
                    updateLives();
                    chunk.removeChild(bullet.sprite);
                    chunk.bullets.splice(j, 1);
                    if (game.player.lives == 0) {
                        gameOver();
                        game.playing = 0;
                        //game.speed = 0;
                    }
                    break;
                }
            }
        }

        let chunk = game.chunks[0];
        game.currentGround = 0;
        game.currentCeiling = 148;

        for (let j = 0; j < chunk.collectibles.length; j++) {
            let o = chunk.collectibles[j];

            if (intersection(o, game.player)) {

                if (o.type == 'heart') {
                    game.player.lives++;
                    playEffect('heart');
                    updateLives();
                }
                else {
                    playEffect('letter');
                    game.addToCollection(o.type);
                }

                chunk.removeChild(o.sprite);
                chunk.collectibles.splice(j, 1);
                break;
            }
        }

        for (let i = 0; i < chunk.objects.length; i++) {

            let o = chunk.objects[i];

            if (intersection(o, game.player)) {
                chunk.objects.splice(i, 1);
                i--;

                o.chunk.addChild(o.renderer);

                game.player.lives--;
                playEffect('damage');
                updateLives();
                if (game.player.lives == 0) {
                    gameOver();
                    game.playing = 0;
                    //game.speed = 0;
                }
            }
            else if (game.player.position[0] > (o.position[0] + o.size[0] + 10)) {
                if (o.point) {
                    game.score++;
                    if (game.score % 50 == 0) {
                        for (let l = 0; l < bulletChunks; l++)
                            genWorldPiece(-1, l == bulletChunks - 1 ? 3 : 2);

                        if (game.mustGenCollectible() && (Math.random() * 100 < chanceToSpawnCollectible))
                            genWorldPiece(-1, 4);
                    }

                    game.elements.score.text(padNumber(game.score, 4));
                    chunk.objects.splice(i, 1);
                    i--;
                }
            }
        }
    }
    //#endregion
}


function jump() {
    /*
    if ((game.doubleJump && (game.player.position[1] < -40 || game.player.velocity <= 0)) || (game.player.position[1] == 0)) {
        game.doubleJump = game.player.position[1] == 0;
 
        game.player.velocity = game.player.jumpForce
    }
    */

    if (game.doubleJump || (game.player.position[1] == game.currentGround)) {
        if (game.player.position[1] == game.currentGround) {
            playEffect("jump");
            game.player.velocity = game.player.jumpForce
        }
        else {
            playEffect("doubleJump");
            game.doubleJump = false;
            game.player.velocity = game.player.jumpForce * 1. + (game.player.position[1] / -20)
        }


    }
}

function createWorldChunk(x, rx, empty = false, bullets = 2) {
    const offset = 200;
    const chunk = new PIXI.Graphics();

    chunk.collectibles = [];
    chunk.starting = x;
    chunk.objects = [];
    chunk.bullets = [];

    let type = Math.floor(Math.random() * 99999) % 4;

    //#region Obstacles And Hearts
    if (!empty) {
        let o = {
            position: [offset + rx, type == 0 ? -46 : 0],
            size: [40, (type == 2) ? 80 : (type == 0 ? 100 : 40)],
            hit: false,
            point: true,
            solid: true
        };
        chunk.objects.push(o);

        if (type == 1) {
            let o = {
                position: [offset + rx, -96],
                size: [40, 50],
                hit: false,
                point: false,
                solid: true
            }
            chunk.objects.push(o);
        }

        if (game.player.lives < 3 && (rx / chunkSize) % 5 == 0 && (Math.random() * 10) < 5) {
            let y = (type == 0 ? -5 : (type == 1 || type == 3 ? -55 : -100));

            const heart = new PIXI.Sprite(hearticon);
            heart.anchor.set(0.5);
            heart.x = offset + 20;
            heart.y = y + groundHeight - 16;
            heart.scale.y = 0.75;
            heart.scale.x = 0.75;
            chunk.addChild(heart);
            chunk.collectibles.push({
                position: [offset + rx, y],
                size: [20, 20],
                sprite: heart,
                type: 'heart',
            });
        }
    }
    //#endregion

    //#region Bullets
    if (bullets == 2) {
        const c = (chunkSize * bulletChunks) * (1.2);
        const start = (-chunkSize * bulletChunks) * (0.8);
        const perChunk = 1;
        const ds = chunkSize / perChunk;

        for (let i = 0; i < c / ds; i++) {
            let y = Math.floor(Math.random() * 100) % 4;
            let dx = ((i + 0.5) * ds) + start;

            switch (y) {
                case 0:
                    createBullet(offset + dx, rx, -10, chunk);
                    createBullet(offset + dx, rx, -95, chunk);

                    if ((i + 1) < c / ds) {
                        dx = ((i + 1) * ds) + start;
                        createBullet(offset + dx, rx, -50, chunk);
                    }
                    break;

                case 1:
                    createBullet(offset + dx, rx, -10, chunk);
                    createBullet(offset + dx, rx, -50, chunk);

                    if ((i + 1) < c / ds) {
                        dx = ((i + 1) * ds) + start;
                        createBullet(offset + dx, rx, -95, chunk);
                    }
                    break;

                case 2:
                    createBullet(offset + dx, rx, -50, chunk);
                    createBullet(offset + dx, rx, -95, chunk);
                    break;

                case 3:
                    createBullet(offset + dx, rx, -15, chunk);
                    i++;

                    if (i < c / ds) {
                        dx = ((i) * ds) + start;
                        createBullet(offset + dx, rx, -15, chunk);
                        createBullet(offset + dx, rx, -50, chunk);

                        dx = ((i + 0.5) * ds) + start;
                        createBullet(offset + dx, rx, -50, chunk);
                    }
                    break;

                default:
                    break;
            }
        }
    }
    else if (bullets == 1) {

        let y = [-50, -90][Math.floor(Math.random() * 100) % 2];
        createBullet(offset - 100, rx, y, chunk);
    }
    //#endregion

    //#region Collectibles
    if (bullets == 3 && game.score % 50 == 0) {
        let y = -50;
        let s = game.getCollectibleToGen();
        let collectible = new PIXI.Text(s, textStyle) // <-
        collectible.anchor.set(0.5);
        collectible.x = offset + 70;
        collectible.y = y + groundHeight;
        chunk.addChild(collectible);
        chunk.collectibles.push({
            position: [offset + rx + 50, y],
            size: [20, 20],
            sprite: collectible,
            type: s
        });
    }
    //#endregion

    //#region World Renderer
    chunk.lineStyle(4, rgbToHex(lerp([255, 255, 255], [230, 173, 67], Math.abs(Math.sin((rx / chunkSize) * 5 * Math.PI / 180)))));

    let top = [0, ceilingHeight];
    let bottom = [0, groundHeight];

    for (let i = 0; i < chunk.objects.length; i++) {
        let o = chunk.objects[i];
        let ground = o.position[1] >= 0;

        let aa = o.position[0] - rx;

        let object = new PIXI.Graphics();
        object.lineStyle(4, 0xff0000);

        if (ground) {
            object.moveTo(aa, groundHeight);
            object.lineTo(aa, groundHeight - o.size[1]);
            object.moveTo(aa + o.size[0], groundHeight - o.size[1]);
            object.lineTo(aa + o.size[0], groundHeight);


            bottom.push(aa, groundHeight)
            bottom.push(aa, groundHeight - o.size[1])
            bottom.push(aa + o.size[0], groundHeight - o.size[1])
            bottom.push(aa + o.size[0], groundHeight)
        }
        else {
            object.moveTo(aa, o.position[1] + groundHeight - o.size[1]);
            object.lineTo(aa, o.position[1] + groundHeight);
            object.moveTo(aa + o.size[0], o.position[1] + groundHeight);
            object.lineTo(aa + o.size[0], o.position[1] + groundHeight - o.size[1]);

            top.push(aa, o.position[1] + groundHeight - o.size[1])
            top.push(aa, o.position[1] + groundHeight)
            top.push(aa + o.size[0], o.position[1] + groundHeight)
            top.push(aa + o.size[0], o.position[1] + groundHeight - o.size[1])
        }

        o.chunk = chunk;
        o.renderer = object;
    }

    top.push(chunkSize, ceilingHeight);
    bottom.push(chunkSize, groundHeight);

    chunk.moveTo(top[0], top[1]);
    for (let i = 2; i < top.length; i += 2)
        chunk.lineTo(top[i], top[i + 1]);

    chunk.moveTo(bottom[0], bottom[1]);
    for (let i = 2; i < bottom.length; i += 2)
        chunk.lineTo(bottom[i], bottom[i + 1]);


    chunk.x = x;

    game.chunks.push(chunk);
    game.app.stage.addChild(chunk);
    //#endregion
}

function createBullet(offset, rx, y, chunk) {
    const bullet = new PIXI.Graphics();
    bullet.lineStyle(3, 0xFF0000);
    let m = [8, 10, 12][Math.floor(Math.random() * 3)];

    let sides = Math.floor(Math.random() * 2) + 3;
    let sd = 360 / sides;

    bullet.moveTo(Math.sin(0 * deg2rad) * m, Math.cos(0 * deg2rad) * m);
    for (let s = 1; s < sides; s++)
        bullet.lineTo(Math.sin(sd * s * deg2rad) * m, Math.cos(sd * s * deg2rad) * m);
    bullet.lineTo(Math.sin(0 * deg2rad) * m, Math.cos(0 * deg2rad) * m);

    bullet.x = offset + 20;
    bullet.y = y + groundHeight - 16;
    chunk.addChild(bullet);
    chunk.bullets.push({
        position: [offset + rx, y],
        size: [20, 20],
        sprite: bullet
    });
}

function rgbToHex(c) {
    return ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]);
}

function lerp(a, b, t) {
    return [Math.floor(a[0] + (b[0] - a[0]) * t), Math.floor(a[1] + (b[1] - a[1]) * t), Math.floor(a[2] + (b[2] - a[2]) * t)];
}

function padNumber(num, size) {
    var s = "00000" + Math.floor(num);
    return s.substring(s.length - size);
}

function intersection(a, b) {

    if (a.position[0] >= b.position[0] + b.size[0]) return false;
    if (a.position[0] + a.size[0] <= b.position[0]) return false;

    if (-a.position[1] >= -b.position[1] + b.size[1]) {
        if (a.solid)
            game.currentCeiling = -a.position[1];
        return false;
    }

    if (-a.position[1] + a.size[1] <= -b.position[1]) {
        if (a.solid)
            game.currentGround = a.position[1] - a.size[1];
        return false;
    }

    return true;
}

function updateLives() {
    $("#lives img").each(function (i, el) {
        if (i >= game.player.lives)
            $(el).css('opacity', '0.25')
        else
            $(el).css('opacity', '1')
    });
}

function gameOver() {

    let isHighscore = game.score > game.getHighscore();
    if (isHighscore) {
        game.setHighscore(game.score);
        $(".highscore").text("HI " + padNumber(game.score, 4));
    }

    game.playing = false;
    $(".menu").addClass("open");
    $("#pageover").addClass("active");

    anime({
        targets: '.menu.open',
        opacity: [0, 1],
        duration: 250,
        easing: 'linear',
    });
}

function playAgain() {

    onGameClose();
    onGameOpen();

    anime({
        targets: '.menu.open',
        opacity: [1, 0],
        duration: 250,
        easing: 'linear',
        complete: () => {
            closeGameWindows();
            $(".menu").removeClass("open");
            game.playing = true;
        }
    });
}

function resumeGame(paused = null) {
    if (paused != null)
        playEffect('resume');
    else
        playEffect('play');

    anime({
        targets: '.menu.open',
        opacity: [1, 0],
        duration: 250,
        easing: 'linear',
        complete: () => {
            closeGameWindows();
            $(".menu").removeClass("open");
            game.playing = true;
        }
    });

    /*
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }
    
        const synth = new Tone.Synth().toDestination();
        const now = Tone.now()
        synth.triggerAttackRelease("C4", "8n", now)
        synth.triggerAttackRelease("E4", "8n", now + 0.5)
        synth.triggerAttackRelease("G4", "8n", now + 1)
        */
}

function playEffect(eff) {
    if (!game.getAudio())
        return;

    if (Tone.context.state !== 'running') {
        Tone.context.resume();
    }

    const now = Tone.now();
    const synth = new Tone.Synth().toDestination();

    switch (eff) {
        case 'play':
            synth.triggerAttackRelease("C3", "18n", now)
            synth.triggerAttackRelease("C3", "18n", now + 1)
            synth.triggerAttackRelease("C4", "18n", now + 2)

            break;
        case 'resume':
            synth.triggerAttackRelease("D3", "18n", now)
            synth.triggerAttackRelease("D3", "18n", now + 0.15)
            break;

        case 'pause':
            synth.triggerAttackRelease("D2", "18n", now)
            synth.triggerAttackRelease("D2", "18n", now + 0.15)
            break;

        case 'pause':
            synth.triggerAttackRelease("G4", "18n", now)
            synth.triggerAttackRelease("G4", "18n", now + 0.15)
            break;

        case 'audioToggle':
            synth.triggerAttackRelease("A3", "18n", now)
            break;

        case 'jump':
            synth.triggerAttackRelease("E2", "10n", now)
            break;

        case 'doubleJump':
            synth.triggerAttackRelease("F2", "10n", now)
            break;

        case 'damage':
            if (game.player.lives == 0) {
                synth.triggerAttackRelease("C2", "18n", now)
                synth.triggerAttackRelease("B1", "9n", now + 0.3)
                synth.triggerAttackRelease("A1", "5n", now + 0.6)
            }
            else
                synth.triggerAttackRelease("B1", "5n", now)
            break;

        case 'heart':
            synth.triggerAttackRelease("D5", "10n", now)
            break;

        case 'letter':
            synth.triggerAttackRelease("E6", "10n", now)
            break;

        default:
            break;
    }
}


function openCollection() {
    $(".menu").addClass("open");

    anime({
        targets: '.menu.open',
        opacity: [1, 0],
        duration: 250,
        easing: 'linear',
        complete: () => {
            onCollectionOpen();
            closeGameWindows();
            $("#pagecollection").addClass("active");
            anime({
                targets: '.menu.open',
                opacity: [0, 1],
                duration: 250,
                easing: 'linear',
            });
        }
    });
}

function closeCollection() {
    $(".menu").addClass("open");

    anime({
        targets: '.menu.open',
        opacity: [1, 0],
        duration: 250,
        easing: 'linear',
        complete: () => {
            onCollectionOpen();
            closeGameWindows();
            $("#pageplay").addClass("active");
            anime({
                targets: '.menu.open',
                opacity: [0, 1],
                duration: 250,
                easing: 'linear',
            });
        }
    });
}

function pauseGame() {
    playEffect('pause');
    game.playing = false;
    $(".menu").addClass("open");
    $("#pagepause").addClass("active");
    $(".currentscore").text(padNumber(game.score, 4));

    anime({
        targets: '.menu.open',
        opacity: [0, 1],
        duration: 250,
        easing: 'linear'
    });
}

function closeGameWindows() {
    $(".menu .page.active").removeClass("active");
}

function onGameClose() {
    closeGameWindows();
    game.app.destroy({ removeView: true })
    game = null;
}

function onCollectionOpen() {
    document.getElementById('pagecollection').scrollTop = 0;

    let s = "";
    let col = game.getCollection();
    for (c in letters) {
        if (col.indexOf(letters[c]) > -1)
            s += '<a class="letter found">' + letters[c] + '</a>'
        else
            s += '<a class="letter">' + letters[c] + '</a>'
    }

    $("#collectioncontent").html(s);
}


//#region Input
$('body').keydown(function (e) {
    if (game != null && game.playing) {
        jump();
    }
});

$('body').mousedown(function () {
    try {
        var x = event.clientX, y = event.clientY;
        let c = document.elementFromPoint(x, y);
        if (c.tagName.toLowerCase() == "canvas")
            if (game != null && game.playing)
                jump();
    } catch (e) { }
});

window.addEventListener('touchstart', function (event) {
    try {
        if (event.target.tagName.toLowerCase() == "canvas")
            if (game != null && game.playing)
                jump();
    } catch (e) { }
}, false);
//#endregion

$(window).blur(function () {
    if (game != null && game.playing) pauseGame()
});

