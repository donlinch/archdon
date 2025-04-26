// This JavaScript code will move the artist tag from the album-info div to the cover-image div
document.addEventListener('DOMContentLoaded', () => {
    // Wait for the page to fully load
    setTimeout(() => {
        // Find all album-cards
        const albumCards = document.querySelectorAll('.album-card');
        
        // For each card, move the artist element
        albumCards.forEach(card => {
            const coverImage = card.querySelector('.cover-image');
            const artist = card.querySelector('.artist');
            
            // If both elements exist, move the artist to the cover image
            if (coverImage && artist) {
                coverImage.appendChild(artist);
            }
        });
    }, 500); // Small delay to ensure all cards are loaded
});