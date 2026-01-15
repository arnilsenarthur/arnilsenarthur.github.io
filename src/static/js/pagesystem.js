let feedPosts = [];
let currentFeedPost = 0;
let lastFeedScrollPos = 0;
let homeAnimationInitialized = false;

function initializeHomeAnimation() {
    // Allow re-initialization when navigating to home page
    // Reset the flag and remove animation-ready class first
    homeAnimationInitialized = false;

    const landingSection = document.querySelector('.landing-section');
    if (landingSection) {
        landingSection.classList.remove('animation-ready');
    }

    document.body.offsetHeight;

    homeAnimationInitialized = true;
    if (landingSection) {
        landingSection.classList.add('animation-ready');

        setTimeout(() => {
            if (window.LandingPage) {
                window.LandingPage.initialize();
            }
        }, 250);
    }
}

window.onhashchange = () => {
    onOpenPage(window.location.hash.substring(1));
};

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (window.destroyTimeline3D) window.destroyTimeline3D();
    } else if (window.location.hash === '#timeline') {
        if (window.ensureTimeline3D) window.ensureTimeline3D();
    }
});

window.addEventListener('pagehide', () => {
    if (window.destroyTimeline3D) window.destroyTimeline3D();
});

let firstOpen = true;
function onOpenPage(page) {
    if (page === '' || page === 'home') {
        setTimeout(() => {
            initializeHomeAnimation();
        }, 100);
    }

    $(".link").removeClass("active");
    $("a[href='#" + page + "']").addClass("active");
    $(".progress").removeClass("fill");

    $(".progress.fill").css('width', '0px');


    function open(justOpened) {
        $(".canvas").scrollTop(0);
        $(".content.current").removeClass("current");

        let $content;
        if (page === '') {
            $content = $(".content").filter(function() {
                return $(this).attr('page') === '';
            });
        } else {
            $content = $(".content[page='" + page + "']");
        }

        $content.css('opacity', 0);
        $content.addClass("current");
        $(".window").css('max-height', '1000px');

        if (page !== "timeline") {
            if (window.destroyTimeline3D) window.destroyTimeline3D();
        } else {
            setTimeout(() => {
                if (window.ensureTimeline3D) window.ensureTimeline3D();
            }, 500);
        }

        const currentPath = window.location.pathname;
        const isPersonaPage = currentPath.includes('/gamedev/') || currentPath.includes('/dev/');

        if(page == "post")
        {
            $(".menubar > .link:not(.return-feed)").addClass("force-hide")
            $(".header > .link:not(.return-feed)").addClass("force-hide")
        }
        else
        {
            // If no persona is selected (home page), only show Home, Contact, and CV
            if (!isPersonaPage) {
                // Show only Home, Contact, and CV
                $(".menubar > .link").each(function() {
                    const href = $(this).attr('href');
                    if (href === '#' || href === '#contact' || href === '#timeline' || href === '/arnilsen_arthur.pdf') {
                        $(this).removeClass("force-hide");
                    } else {
                        $(this).addClass("force-hide");
                    }
                });
                $(".header > .link").each(function() {
                    const href = $(this).attr('href');
                    if (href === '#' || href === '#contact' || href === '#timeline' || href === '/arnilsen_arthur.pdf') {
                        $(this).removeClass("force-hide");
                    } else {
                        $(this).addClass("force-hide");
                    }
                });
            } else {
                $(".menubar > .link:not(.return-feed)").removeClass("force-hide")
                $(".header > .link:not(.return-feed)").removeClass("force-hide")
            }
        }

        
        var menuBarHidden = page == "game" || page == "timeline";

        $(".link.return").css('display', menuBarHidden ? 'block' : 'none');
        $(".link.return-feed").css('display', (page == "post") ? 'block' : 'none');

        if(menuBarHidden)
        {
            $(".menubar").addClass("hidden");
        }
        else
        {
            $(".menubar").removeClass("hidden");
        }

        if (page == "game") {
            if (window.lazyLoadGameScripts) {
                window.lazyLoadGameScripts();
                setTimeout(() => {
                    onGameOpen();
                    $(".menu").addClass("open");
                    $("#pageplay").addClass("active");
                }, 1000);
            } else {
                onGameOpen();
                $(".menu").addClass("open");
                $("#pageplay").addClass("active");
            }
        }
        else if (typeof game !== 'undefined' && game != null) {
            onGameClose();
        }

        if(page == "feed")
        {
            $(".menubar").removeClass("hidden");
            $(".menu").addClass("open");
            
            $.get("https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@arnilsenarthur", function( data ) {
                
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                ];
                let papers = "";
            
                for(var i in data.items)
                {
                    let paper = data.items[i];
                    let date = new Date(paper.pubDate);
                    let description = paper.description.replace(/(<figure>.*<\/figure>)|(<img[^>]*>)|(<figcaption>.*<\/figcaption>)/, "").replace(/<\/?[^>]+(>|$)/g, "");

                    paper.date = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
                    
                    feedPosts.push({
                        date: paper.date,
                        content: paper.content,
                        title: paper.title
                    });
                    //papers += `<div class="paperitem" onclick="window.open('${paper.link}', '_blank').focus();">${paper.date}<br><b class="papertitle">${paper.title}</b><br><div class="paperdesc">${description}</div></div><br>\n`;
                    papers += `<div class="paperitem" onclick="lastFeedScrollPos = $('#papers').scrollTop(); currentFeedPost = ${feedPosts.length - 1}; onOpenPage('post');">${paper.date}<br><b class="papertitle">${paper.title}</b><br><div class="paperdesc">${description}</div></div><br>\n`;
                }

                $("#paperscontent").html(papers);
                $('#papers').scrollTop(lastFeedScrollPos);
            });
        }

        if(page == "post")
        {
            let post = feedPosts[currentFeedPost];
            $("#postcontent").scrollTop(0);
            $("#postcontent").html(`<br>${post.date}<h1>${post.title}</h1><div class="separator"></div>${post.content}`);
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

function reopenFeed() {
    onOpenPage("feed");
}

function closeContents(callback) {
    anime({
        targets: '.content.current',
        opacity: [1, 0],
        duration: 500,
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
        targets: '.content.current *:not(.timeline):not(b):not(.landing-section):not(.landing-section *):not(.timeline-ui-overlay):not(.timeline-ui-overlay *):not(#timeline-canvas-container):not(#timeline-canvas-container *) , .content.current:not(.timeline):not(b)',
        opacity: [0, 1],
        duration: 500,
        delay: function (el, i, l) {
            if ($(el).hasClass("progress")) {

                setTimeout(() => {
                    $(el).css('width', '');
                    $(el).addClass("fill");
                },100);
            }

            if (l < 10)
                return i * 100;
            if (l < 30)
                return i * 50;

            return i * 2;
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


// Persona Switching Functionality
function switchToGames() {
    localStorage.setItem('lastPersonaPage', 'gamedev');
    // Navigate to gamedev persona page
    window.location.href = '/gamedev/';
}

function switchToDevelopment() {
    localStorage.setItem('lastPersonaPage', 'dev');
    // Navigate to dev persona page
    window.location.href = '/dev/';
}

function updatePersonaUI(persona) {
    // Update header and navigation based on persona
    const header = $('.header');
    if (persona === 'gamedev') {
        header.addClass('game-theme');
        header.removeClass('dev-theme');
    } else {
        header.addClass('dev-theme');
        header.removeClass('game-theme');
    }

    // Update toggle button states
    $('.toggle-btn').removeClass('active');
    if (persona === 'gamedev') {
        $('.toggle-btn.game-mode').addClass('active');
    } else {
        $('.toggle-btn.dev-mode').addClass('active');
    }

    // Update navigation visibility based on persona
    updateNavigationVisibility(persona);
}

function updateNavigationVisibility(persona) {
    const isPersonaPage = persona === 'gamedev' || persona === 'dev';

    if (!isPersonaPage) {
        // Show only Home, Contact, and CV
        $(".menubar > .link").each(function() {
            const href = $(this).attr('href');
            if (href === '#' || href === '#contact' || href === 'arnilsen_arthur.pdf') {
                $(this).removeClass("force-hide");
            } else {
                $(this).addClass("force-hide");
            }
        });
        $(".header > .link").each(function() {
            const href = $(this).attr('href');
            if (href === '#' || href === '#contact' || href === 'arnilsen_arthur.pdf') {
                $(this).removeClass("force-hide");
            } else {
                $(this).addClass("force-hide");
            }
        });
    } else {
        // Show all navigation items
        $(".menubar > .link:not(.return-feed)").removeClass("force-hide")
        $(".header > .link:not(.return-feed)").removeClass("force-hide")
    }
}

// Project Filtering Functionality
$(document).ready(function() {

    // Function to apply filter
    function applyFilter(filter) {
        // Update active button
        $('.filter-btn').removeClass('active');
        $(`.filter-btn[data-filter="${filter}"]`).addClass('active');

        // Filter projects
        if (filter === 'all') {
            $('.project-item').removeClass('hidden');
        } else {
            $('.project-item').each(function() {
                const projectTags = $(this).data('tags') || '';
                const tagArray = projectTags.split(',').map(tag => tag.trim());
                if (tagArray.includes(filter)) {
                    $(this).removeClass('hidden');
                } else {
                    $(this).addClass('hidden');
                }
            });
        }
    }

    // Project filter click functionality
    $('.filter-btn').on('click', function() {
        const filter = $(this).data('filter');
        applyFilter(filter);
    });

    // Full Screen Image Viewer Functionality
    $('.project-image').on('click', function() {
        const imageSrc = $(this).attr('src');
        const imageAlt = $(this).attr('alt');

        $('#fullscreen-image').attr('src', imageSrc);
        $('#fullscreen-image').attr('alt', imageAlt);
        $('#fullscreen-image-viewer').fadeIn(200);
    });
});

// Function to close full screen image viewer
function closeFullscreenImage() {
    $('#fullscreen-image-viewer').fadeOut(200);
}

// Close fullscreen viewer on ESC key
$(document).on('keydown', function(e) {
    if (e.keyCode === 27 && $('#fullscreen-image-viewer').is(':visible')) {
        closeFullscreenImage();
    }
});

