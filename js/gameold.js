//#region Main Game Object
let game = null;
//#endregion

const s = (sketch) => {
    sketch.setup = () => {
        p5.disableFriendlyErrors = true;
        sketch.disableFriendlyErrors = true;
        sketch.frameRate(60)
        let cnv = sketch.createCanvas($("#gamecanvas").width(), 150);
        cnv.parent('gamecanvas');

        game.height = 150;
        game.width = $("#gamecanvas").width();
        game.sketch = this;

        game.elements.score = $(".game #score")

        $(".highscore").text("HI " + padNumber(game.getHighscore(), 4));

    };

    sketch.draw = () => {
        sketch.clear()
        sketch.noFill();
        sketch.background(255, 255, 255, 0);

        let groundHeight = sketch.height - 5;
        let delta = sketch.deltaTime / 1000;
        let preDistance = game.distance;

        //#region UI Refresh
        game.refreshTimer += delta;
        if (game.refreshTimer >= 0.2) {
            game.elements.score.text(padNumber(game.score, 4));
            game.refreshTimer -= 0.2;
        }
        //#endregion

        //#region Update Player Physics
        if (game.playing) {
            game.player.position[1] -= game.player.velocity * delta * game.speed;
            game.player.velocity -= game.player.gravityForce * delta * game.speed;

            if (game.player.position[1] > 0) {
                game.player.position[1] = 0;
                game.player.velocity = 0;
            }

            //Update game variables
            game.distance += delta * game.speed;
            game.speed += delta / 100;
        }
        //#endregion

        //#region Draw Area
        sketch.stroke(game.mapColor[0], game.mapColor[1], game.mapColor[2])
        sketch.strokeWeight(4);

        //Draw player
        let o = game.player;
        sketch.rect(o.position[0] - o.size[0] / 2, o.position[1] + groundHeight, o.size[0], -o.size[1]);

        //Draw ground
        let base = getNextOnGround(-1);
        if (base != null) {
            if (base.position[0] - base.size[0] / 2 >= 4) {
                let gEnd = Math.min(base.position[0] - base.size[0] / 2 - 5)
                sketch.line(4, groundHeight, gEnd, groundHeight);
            }
        }
        else
            sketch.line(4, groundHeight, sketch.width - 4, groundHeight);

        delete base;

        //Draw objects
        for (let i = 0; i < game.objects.length; i++) {
            sketch.stroke(game.mapColor[0], game.mapColor[1], game.mapColor[2])

            let o = game.objects[i];
            let hit = intersection(o, game.player);

            let aa = o.position[0] - o.size[0] / 2;
            let bb = o.position[0] + o.size[0] / 2;
            let cc = o.position[1] + groundHeight - o.size[1];

            if (hit) {
                sketch.stroke(255, 0, 0)

                if (!o.hit) {
                    o.hit = true;
                    game.player.lives--;
                    updateLives();
                    if (game.player.lives == 0) {
                        gameOver();
                        game.playing = 0;
                        game.speed = 0;
                    }
                }

                if (o.position[1] < 0)
                    sketch.rect(aa, o.position[1] + groundHeight, o.size[0], -o.size[1]);
                else {
                    sketch.beginShape();
                    sketch.vertex(aa, groundHeight);
                    sketch.vertex(aa, cc);
                    sketch.vertex(bb, cc);
                    sketch.vertex(bb, groundHeight);
                    sketch.endShape();

                    sketch.stroke(game.mapColor[0], game.mapColor[1], game.mapColor[2])

                    let n = getNextOnGround(i);
                    if (n != null)
                        sketch.line(bb, groundHeight, n.position[0] - n.size[0] / 2 - 5, groundHeight);
                    else
                        sketch.line(bb, groundHeight, sketch.width - 4, groundHeight);
                }
            }
            else {
                if (o.position[1] < 0)
                    sketch.rect(aa, o.position[1] + groundHeight, o.size[0], -o.size[1]);
                else {
                    sketch.beginShape();
                    sketch.vertex(aa, groundHeight);
                    sketch.vertex(aa, cc);
                    sketch.vertex(bb, cc);
                    sketch.vertex(bb, groundHeight);


                    let n = getNextOnGround(i);
                    if (n != null)
                        sketch.vertex(n.position[0] - n.size[0] / 2 - 5, groundHeight);
                    else
                        sketch.vertex(sketch.width - 4, groundHeight);
                    sketch.endShape();
                }
            }


            if (o.position[0] < 100 && o.point && !o.hit) {
                o.point = false;
                game.score++;
            }

            if (o.position[0] + o.size[0] / 2 < 5) {
                game.objects.splice(i, 1);
                i--;
            }

            if (game.playing)
                o.position[0] -= delta * game.speed * 300;
        }
        //#endregion

        //#region Draw hearts
        sketch.stroke(255, 0, 0)
        for (let i = 0; i < game.hearts.length; i++) {
            let o = game.hearts[i];
            let hit = intersection(o, game.player);

            sketch.drawHeart(o.position[0], o.position[1] + groundHeight - 25, 20);

            if (game.playing)
                o.position[0] -= delta * game.speed * 300;

            if (hit) {
                game.player.lives++;
                updateLives();
                sketch.stroke(255, 255, 255)
                game.hearts.splice(i, 1);
                i--;
            }

            if (o.position[0] + o.size[0] / 2 < 5) {
                game.hearts.splice(i, 1);
                i--;
            }
        }
        //#endregion

        //#region Spawn Objects
        if (Math.floor(game.distance / 1.5) != Math.floor(preDistance / 1.5))
            spawnObject();
        //#endregion
    };


    sketch.jump = () => {
        if ((game.doubleJump && (game.player.position[1] < -40 || game.player.velocity <= 0)) || (game.player.position[1] == 0)) {
            game.doubleJump = game.player.position[1] == 0;

            game.player.velocity = game.player.jumpForce
        }
    }

    sketch.keyPressed = () => {
        if (sketch.keyCode === 32 && game.playing)
            sketch.jump();
    }

    sketch.touchStarted = () => {

        try {
            var x = event.clientX, y = event.clientY;
            let c = document.elementFromPoint(x, y);
            if (c.tagName.toLowerCase() == "canvas")
                if (game.playing && !game.mouse)
                    sketch.jump();
        } catch (e) { }
    }

    sketch.drawHeart = (x, y, size) => {
        sketch.beginShape();
        sketch.vertex(x, y);
        sketch.bezierVertex(x - size / 2, y - size / 2, x - size, y + size / 3, x, y + size);
        sketch.bezierVertex(x + size, y + size / 3, x + size / 2, y - size / 2, x, y);
        sketch.endShape(sketch.CLOSE);
    }
};

function newGame() {
    game = {
        playing: false,
        elements: {},
        refreshTimer: 0,
        getHighscore: () => {
            let hg = localStorage.getItem("highscore");
            return hg == null ? 0 : parseInt(hg);
        },
        setHighscore: (value) => {
            localStorage.setItem("highscore", value);
        },
        score: 0,
        width: 0,
        height: 0,
        distance: 0,
        sketch: null,
        doubleJump: false,
        player: {
            position: [100, 0],
            size: [30, 30],
            jumpForce: 325,
            gravityForce: 940,
            velocity: 325,
            lives: 3
        },
        mapColor: [255, 255, 255],
        speed: 1,
        objects: [],
        objectsOnGround: [],
        hearts: [

        ]
    }

    createLives();
}

function createLives() {
    $("#lives").html('<img src="img/heart.png">'.repeat(game.player.lives));
}

function updateLives() {
    $("#lives img").each(function (i, el) {
        if (i >= game.player.lives)
            $(el).css('opacity', '0.25')
        else
            $(el).css('opacity', '1')
    });
}

function windowResized() {
    if (game == null)
        return;

    game.objects = [];

    game.height = 150;
    game.width = $("#gamecanvas").width();

    game.p5.resizeCanvas($("#gamecanvas").width(), $("#gamecanvas").height());
}


//#region Utils
function spawnObject() {
    let type = Math.floor(Math.random() * 99999) % 4;

    game.objects.push({
        position: [game.width + 100, type == 0 ? -40 : 0],
        size: [40, (type == 2) ? 80 : (type == 0 ? 120 : 40)],
        hit: false,
        point: true
    });

    if (type == 1)
        game.objects.push({
            position: [game.width + 100, -100],
            size: [40, 100],
            hit: false,
            point: false
        });


    if (game.player.lives < 3 && game.score % 5 == 0 && (Math.random() * 10) < 5)
        spawnHeart(game.width + 100, type == 0 ? -5 : (type == 1 || type == 3 ? -55 : -100))
}

function spawnHeart(x, y) {
    let o = {
        position: [x, y],
        size: [30, 30],
    };
    game.hearts.push(o);
}

function getNextOnGround(i) {
    for (let n = i + 1; n < game.objects.length; n++)
        if (game.objects[n].position[1] >= 0)
            return game.objects[n];

    return null;
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
//#endregion

window.addEventListener('resize', function (event) {
    windowResized();
}, true);

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

function closeGameWindows() {
    $(".menu .page.active").removeClass("active");
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

function playAgain() {

    game.p5.remove();
    game = null;
    newGame();
    game.p5 = new p5(s);

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