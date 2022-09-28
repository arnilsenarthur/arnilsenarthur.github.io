window.onhashchange = () => {
    onOpenPage(window.location.hash.substring(1));
};

let firstOpen = true;
function onOpenPage(page) {

    $(".link").removeClass("active");
    $("a[href='#" + page + "']").addClass("active");
    $(".progress").removeClass("fill");

    $(".progress.fill").css('width', '0px');
    //$(".progress.fill").removeClass("fill");    


    function open(justOpened) {
        $(".canvas").scrollTop(0);
  
        if (page == "timeline") {
            let timeline = [
                {
                    date: '2002',
                    text: 'I was born',
                    left: 'My parents say I fell in love with numbers from the first time they taught me how to count. I always liked logic and math. As I grew up,I started to fall in love with games too.',
                    right: 'I wasn\'t just passionate about playing the games, I was passionate about how they were made. It felt like magic to me, and to be honest, there is a kind of magic behind games',
                    leftFirst: false
                },
                {
                    date: '2008',
                    text: 'My First PC',
                    left: 'My parents bought a computer. As I didn\'t have internet, I spent the days having fun with <b>Microsoft Office</b> applications. I loved doing PowerPoint animations and trying to make systems in Microsoft Access.<br><img src="img/microsoft_access.png" class="smallimg"></img>',
                    right: 'Having played some games at my cousins ​​house, I kept thinking about how games were made and started trying with what I had to make some kind of game. I scribbled dozens of notebooks with ideas for games I wanted to make, even though I didn\'t even know how to start.',
                    leftFirst: true
                },
                {
                    date: '2012',
                    text: 'The Turning Point',
                    left: 'Because of the school, we put internet at home. I remember like it was yesterday, when I was asked to test the internet and I did my first search: Game. The first result that appeared was Minecraft. That was the turning point',
                    right: 'So I ran to download, and that\'s when it all started. From this point I started to spend more and more hours in gaming...<br><br><img src="https://cdn.icon-icons.com/icons2/2699/PNG/512/minecraft_logo_icon_168974.png" class="smallimg"></img>',
                    leftFirst: true
                },
                {
                    date: '2013',
                    text: 'A New Developer Has Born',
                    left: '<img src="img/timeline_0.png" class="bigimg"></img>',
                    right: 'Playing minecraft, I found that people were able to make mods/plugins to add what they wanted to the game. So I found a way to learn it. Since that day I started to learn java.',
                    leftFirst: false
                },
                {
                    date: '2017',
                    text: 'Information Technology Course',
                    left: 'After a few years of practice in <b>Java</b>, mainly focused on <b>LWJGL</b> (Which helped me to learn many programming/rendering concepts) I entered an IT course, where I learned Web/Android Apps development. My dream of being a game developer was interrupted',
                    right: 'I finished the course in 2018 and I started to develop some systems for companies in the region, and some websites (like this one)<br><br><img src="img/hda_logo.png" class="mediumimg"></img>',
                    leftFirst: true
                },
                {
                    date: '2020',
                    text: 'Game Development College',
                    left: 'Everything changed again at the end of 2019. I found out that a university near where I lived had a game development course, and I joined, and I\'m still taking it right now. My childhood dream seemed to get closer and closer.',
                    right: 'During the course I\'m producing some games that you can find in the <a class="innerlink" href="#projects">Projects</a> tab.<b><img src="img/sketch_fleets_0.png" class="bigimg"></img>',
                    leftFirst: true
                },
                {
                    date: '2021',
                    text: 'Joined LionSpoon',
                    right: 'In 2021 I was appointed by a college friend to work at <b>LionSpoon Dream Game Technology</b>, a Chinese game company. Since then I\'m working online as a game developer.',
                    left: '<img src="img/lion_spoon.png" class="bigimg"></img>',
                    leftFirst: false
                },
                {
                    date: '2022',
                    text: 'Improving Skills',
                    right: '<img src="img/chess_0.gif" class="bigimg"></img>',
                    left: 'While studying I keep doing side projects to improve my skills and build up portifolio. The biggest side project I made this year was <a href="https://github.com/arnilsenarthur/unitychessgame"><b>UnityChessGame</b><i class="fa fa-external-link linkicon"></i></a>',
                    leftFirst: false
                },
                {
                    date: 'Now',
                    text: 'Developing Games<br><img src="img/heart.png" class="tinyimg"></img>',
                    right: '',
                    left: '',
                    leftFirst: false
                },
            ]

            $(document).ready(function () {

                //Generate timeline
                let html = '';
                for (let i = 0; i < timeline.length; i++) {
                    if (i > 0)
                        html += '<div class="timeline line"></div>';

                    let t = timeline[i];
                    if (t.leftFirst) {
                        html += `<div class="timeline step">
                    <div class="timeline header">
                            <div class="timeline date">${t.date}</div>
                            <div class="timeline div"></div>
                            <div class="timeline text">
                                ${t.text}
                            </div>
                        </div>
                        <div class="timeline data left">
                            ${t.left}
                        </div>
                        <div class="timeline data right">
                            ${t.right}
                        </div>  
                    </div>`;
                    }
                    else {
                        html += `<div class="timeline step">
                    <div class="timeline header">
                            <div class="timeline date">${t.date}</div>
                            <div class="timeline div"></div>
                            <div class="timeline text">
                                ${t.text}
                            </div>
                        </div>
                        <div class="timeline data right">
                            ${t.right}
                        </div>
                        <div class="timeline data left">
                            ${t.left}
                        </div>  
                    </div>`;
                    }
                }


                $("#timeline").html(html);
                $("#timeline").css('visibility', 'hidden');

                setTimeout(() => {
                    updateView();
                    $(".timeline").each(function () {
                        let h = $(this).css('opacity');
                        $(this).fadeTo(1, 0);
                        $(this).fadeTo(200, parseFloat(h));
                    });
                    $("#timeline").css('visibility', 'visible');

                }, 400);

            });
        }

        $(".content.current").removeClass("current");
        $(".content[page='" + page + "']").css('opacity', 0);
        $(".content[page='" + page + "']").addClass("current");
        $(".window").css('max-height', '1000px');

        $(".link.return").css('display', page == "game" ? 'block' : 'none');

        if (page == "game") {
            $(".menubar").addClass("hidden");

            onGameOpen();
            $(".menu").addClass("open");
            $("#pageplay").addClass("active");
        }
        else if (game != null) {
            $(".menubar").removeClass("hidden");


            onGameClose();
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
        targets: '.content.current *:not(.timeline):not(b) , .content.current:not(.timeline):not(b)',
        //translateY: [-200, 0],
        opacity: [0, 1],
        duration: 1000,
        delay: function (el, i, l) {
            if ($(el).hasClass("progress")) {
                

                setTimeout(() => {
                    $(el).css('width', '');
                    $(el).addClass("fill");
                },100);
            }

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