function pickColor() {
    var colorArray = ["red", "green", "yellow", "blue"];
    return colorArray[Math.floor(Math.random() * colorArray.length)];
}

function pickPos() {
    return 0;
}

function addSquare() {
    var div = document.createElement("div");
    div.className = "backdiv";

    div.style.background = pickColor();
    div.style.position = "absolute";
    div.style.left = "50%";
    div.style.top = "50%";
    div.style.width = div.style.height = (Math.random() * 400 + 180) + 'px';
    let deg = Math.random() * 360;
    div.style.webkitTransform = 'translate(-50%, -50%) rotate(' + deg + 'deg)';
    div.style.mozTransform = 'translate(-50%, -50%) rotate(' + deg + 'deg)';
    div.style.msTransform = 'translate(-50%, -50%) rotate(' + deg + 'deg)';
    div.style.oTransform = 'translate(-50%, -50%) rotate(' + deg + 'deg)';
    div.style.transform = 'translate(-50%, -50%) rotate(' + deg + 'deg)';

    let n = [16, 8, 24, 32, 18][Math.floor(Math.random() * 5)];
    div.style.backgroundColor = 'rgb(' + n + ',' + n + ',' + n + ')';
    div.style.borderRadius = '25%';

    $(".back").append(div);
}


function initBackground() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                    window.innerWidth < 768;

    const numSquares = isMobile ? 3 : 10;

    for (let i = 0; i < numSquares; i++)
        addSquare();

    animSquares();
}

function animSquares() {
    anime({
        targets: '.backdiv',
        translateY: function () { return anime.random(-50, 50) + 'vh'; },
        translateX: function () { return anime.random(-50, 50) + 'vw'; },
        scale: function () { return anime.random(5, 15) / 10; },
        rotate: function () { return anime.random(0, 90); },
        duration: function () { return anime.random(1000, 2000); },
        direction: 'alternate',
        loop: false,
        complete: function (anim) {
            animSquares();
        }
    });
}