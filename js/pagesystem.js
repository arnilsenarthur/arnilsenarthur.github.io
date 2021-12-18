window.onhashchange = () => {
    onOpenPage(window.location.hash.substring(1));
};

let firstOpen = true;
function onOpenPage(page) {

    $(".link").removeClass("active");
    $("a[href='#" + page + "']").addClass("active");

    function open(justOpened) {
        
        $(".content.current").removeClass("current");
        $(".content[page='" + page + "']").css('opacity', 0);
        $(".content[page='" + page + "']").addClass("current");
        $(".window").css('max-height', '1000px');

        $(".link.return").css('display',page == "game"? 'block' : 'none');

        if (page == "game") {
            $(".menubar").addClass("hidden");

            newGame();
            $(".menu").addClass("open");
            $("#pageplay").addClass("active");

            if(game == null || game.p5 == null)
                game.p5 = new p5(s);
        }
        else if(game != null && game.p5 != null)
        {  
            $(".menubar").removeClass("hidden");

            game.p5.remove();
            game = null;
        }

        openContents(justOpened != null);
    }

    if (!firstOpen) {
        $(".window").css('max-height', '30px');
        closeContents(open);
    }
    else
        open(true);

    firstOpen = false;
}

function closeContents(callback) {
    anime({
        targets: '.content.current',
        opacity: [1, 0],
        duration: 1000,
        complete: callback
    });

    anime({
        targets: '.window',
        translateX: '-50%',
        translateY: '-50%',
        perspective: '800px',
        rotateX: -30,
        rotateY: 20,
        easing: 'spring(0.5, 80, 5, 0)',
    });
}

function openContents(needToShake) {
    anime({
        targets: '.content.current * , .content.current',
        //translateY: [-200, 0],
        opacity: [0, 1],
        duration: 1000,
        delay: function (el, i, l) {
            if (l < 10)
                return i * 100;
            return i * 50;
        },
    });

    if (needToShake)
        anime({
            targets: '.window',
            translateX: '-50%',
            translateY: '-50%',
            perspective: '800px',
            rotateX: 0,
            rotateY: 0,
            easing: 'spring(0.5, 80, 5, 0)',
        });
}