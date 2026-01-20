const subtitles = [
    "Creating immersive multiplayer experiences and scalable software solutions",
    "Game Developer & Software Engineer - Crafting digital worlds since age 13",
    "Building the future of interactive entertainment and enterprise applications",
    "Unity expert, full-stack developer, and creative problem solver",
    "From game jams to enterprise systems - passionate about great code"
];

function initializeLandingPage() {
    setTimeout(() => {
        setRandomSubtitle();
    }, 800);

    const personaCards = document.querySelectorAll('.persona-card');
    personaCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.boxShadow = '0 10px 30px rgba(107, 114, 128, 0.3)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.boxShadow = '';
        });
    });
}

function setRandomSubtitle() {
    const subtitleElement = document.querySelector('.landing-subtitle');

    if (!subtitleElement) return;

    const randomIndex = Math.floor(Math.random() * subtitles.length);
    subtitleElement.textContent = subtitles[randomIndex];
}

window.LandingPage = {
    initialize: initializeLandingPage
};