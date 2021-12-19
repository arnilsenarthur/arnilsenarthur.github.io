var game = null;
const groundHeight = 148;
const ceilingHeight = 2;
const chunkSize = 350;
const hearticon = PIXI.Texture.from('img/heart.png');

function onGameOpen() { 
    game = {
        playing: false,
        graphics: null,
        firstFrame: true,
        app: null,
        speed: 1,
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
        objects: [],
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
        }
    };

    //Update score & highscore
    game.elements.score.text(padNumber(game.score, 4));
    $(".highscore").text("HI " + padNumber(game.getHighscore(), 4));
    

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
    player.drawRect(game.player.position[0] - game.player.size[0] / 2, game.player.position[1] + groundHeight - game.player.size[0], game.player.size[0], game.player.size[1]);
    game.app.stage.addChild(player);

    game.graphics = { player: player };
}

function onGameUpdate(delta) {
    //#region Update
    if (game.playing || game.firstFrame) {
        game.firstFrame = false;

        game.player.position[1] -= game.player.velocity * delta * game.speed;
        game.player.velocity -= game.player.gravityForce * delta * game.speed;


        if (game.player.position[1] > 0) {
            game.player.position[1] = 0;
            game.player.velocity = 0;
        }

        game.graphics.player.y = game.player.position[1];

        //Update game variables
        game.distance += delta * game.speed * 300;
        game.speed += delta / 100;

        //Update world pieces
        for (let i = Math.max(game.lastGeneratedChunk + 1, Math.floor(game.distance / chunkSize)); i < Math.ceil((game.distance + game.app.view.width) / chunkSize); i++) {
            let x = game.chunks.length == 0 ? 0 : game.chunks[game.chunks.length - 1].x + chunkSize;
            createWorldChunk(x, i <= 2);
            game.lastGeneratedChunk = i;
        }

        for (let i = 0; i < game.chunks.length; i++) {
            let chunk = game.chunks[i];
            if ((chunk.x -= delta * game.speed * 300) < -chunkSize) {
                game.app.stage.removeChild(chunk);
                game.chunks.splice(i, 1);
                i--;
            }


            for (let j = 0; j < chunk.hearts.length; j++) {
                let o = chunk.hearts[j];
                o.position[0] -= delta * game.speed * 300;
                if (intersection(o, game.player)) {
                    game.player.lives++;
                    updateLives();
                    chunk.removeChild(o.sprite);
                    chunk.hearts.splice(j, 1);
                    j--;
                }
            }
        }



        for (let i = 0; i < game.objects.length; i++) {
            let o = game.objects[i];

            if ((o.position[0] -= delta * game.speed * 300) <= 80 && o.point) {
                game.score++;
                game.elements.score.text(padNumber(game.score, 4));
                game.objects.splice(i, 1);
                i--;
            }
            else if (intersection(o, game.player)) {
                game.objects.splice(i, 1);
                i--;

                o.chunk.addChild(o.renderer);

                game.player.lives--;
                updateLives();
                if (game.player.lives == 0) {
                    gameOver();
                    game.playing = 0;
                    game.speed = 0;
                }
            }
        }
    }
    //#endregion
}


function jump() {
    if ((game.doubleJump && (game.player.position[1] < -40 || game.player.velocity <= 0)) || (game.player.position[1] == 0)) {
        game.doubleJump = game.player.position[1] == 0;

        game.player.velocity = game.player.jumpForce
    }
}

function createWorldChunk(x, empty = false, size = chunkSize) {
    const offset = 100;
    const chunk = new PIXI.Graphics();

    chunk.hearts = [];

    let objects = [];

    let type = Math.floor(Math.random() * 99999) % 4;

    if (!empty) {

        let o = {
            position: [offset + x, type == 0 ? -46 : 0],
            size: [40, (type == 2) ? 80 : (type == 0 ? 100 : 40)],
            hit: false,
            point: true
        };
        objects.push(o);
        game.objects.push(o);

        if (type == 1) {
            let o = {
                position: [offset + x, -96],
                size: [40, 50],
                hit: false,
                point: false
            }
            objects.push(o);
            game.objects.push(o);
        }

        if (game.player.lives < 3 && game.score % 5 == 0 && (Math.random() * 10) < 5) {
            let y = (type == 0 ? -5 : (type == 1 || type == 3 ? -55 : -100));

            const heart = new PIXI.Sprite(hearticon);
            heart.anchor.set(0.5);
            heart.x = offset;
            heart.y = y + groundHeight - 16;
            heart.scale.y = 0.75;
            heart.scale.x = 0.75;
            chunk.addChild(heart);
            chunk.hearts.push({
                position: [offset + x, y],
                size: [40, 50],
                sprite: heart
            });
        }
    }


    chunk.lineStyle(4, 0xffffff);

    let top = [0, ceilingHeight];
    let bottom = [0, groundHeight];

    for (let i = 0; i < objects.length; i++) {
        let o = objects[i];
        let ground = o.position[1] >= 0;

        let aa = o.position[0] - x - o.size[0] / 2;

        let object = new PIXI.Graphics();
        object.lineStyle(4, 0xff0000);

        if (ground) {
            object.moveTo(aa, groundHeight);
            object.lineTo(aa, groundHeight - o.size[1]);
            object.lineTo(aa + o.size[0], groundHeight - o.size[1]);
            object.lineTo(aa + o.size[0], groundHeight);


            bottom.push(aa, groundHeight)
            bottom.push(aa, groundHeight - o.size[1])
            bottom.push(aa + o.size[0], groundHeight - o.size[1])
            bottom.push(aa + o.size[0], groundHeight)
        }
        else {
            object.moveTo(aa, o.position[1] + groundHeight - o.size[1]);
            object.lineTo(aa, o.position[1] + groundHeight);
            object.lineTo(aa + o.size[0], o.position[1] + groundHeight);
            object.lineTo(aa + o.size[0], o.position[1] + groundHeight - o.size[1]);

            top.push(aa, o.position[1] + groundHeight - o.size[1])
            top.push(aa, o.position[1] + groundHeight)
            top.push(aa + o.size[0], o.position[1] + groundHeight)
            top.push(aa + o.size[0], o.position[1] + groundHeight - o.size[1])
        }

        objects[i].chunk = chunk;
        objects[i].renderer = object;
    }

    top.push(size, ceilingHeight);
    bottom.push(size, groundHeight);

    chunk.moveTo(top[0], top[1]);
    for (let i = 2; i < top.length; i += 2)
        chunk.lineTo(top[i], top[i + 1]);

    chunk.moveTo(bottom[0], bottom[1]);
    for (let i = 2; i < bottom.length; i += 2)
        chunk.lineTo(bottom[i], bottom[i + 1]);


    chunk.x = x;

    game.chunks.push(chunk);
    game.app.stage.addChild(chunk);
}

function spawnHeart(x, y) {

}


function padNumber(num, size) {
    var s = "00000" + Math.floor(num);
    return s.substring(s.length - size);
}

function intersection(a, b) {
    if (a.position[0] >= b.position[0] + b.size[0] || b.position[0] >= a.position[0] + a.size[0]) return false;
    if (-a.position[1] >= -b.position[1] + b.size[1] || -b.position[1] >= -a.position[1] + a.size[1]) return false;

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
        $(".highscore").text("HI " + padNumber(game.getHighscore(), 4));
        game.setHighscore(game.score);
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

function resumeGame() {
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


function pauseGame() {
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
    game.app.destroy({ removeView: true })
    game = null;
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
    } catch (e) { 
        console.log(e);
    }
}, false);
//#endregion
