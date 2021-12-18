function initAnimations() {
    anime({
        targets: '.dot',
        translateY: [-20, 0],
        opacity: 1,
        direction: 'alternate',
        loop: true,
        duration: 1000,
        easing: 'spring(1, 80, 10, 0)',
        delay: function (el, i, l) {
            return i * 100;
        },
        endDelay: function (el, i, l) {
            return (l - i) * 100;
        }
    });

    anime({
        targets: '.window',
        opacity: [0, 1],
        translateX: ['-50%', '-50%'],
        translateY: ['-50%', '-50%'],
        perspective: ['800px', '800px'],
        rotateX: [150, 0],
        rotateY: [20, 0],
        easing: 'spring(0.5, 80, 5, 0)',
    });


    anime({
        targets: '.link',
        translateY: [-20, 0],
        opacity: 1,
        direction: 'alternate',
        loop: false,
        duration: 1000,
        easing: 'spring(1, 80, 10, 0)',
        delay: function (el, i, l) {
            return 500 + i * 100;
        },
        endDelay: function (el, i, l) {
            return (l - i) * 100;
        }
    });
}