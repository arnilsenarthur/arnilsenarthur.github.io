# Simple CV Generator

This folder contains a script to generate a clean, professional PDF CV based on the website's data.

## Usage

Run the following command from the project root:

```bash
npm run generate-cv
```

This will generate `dist/arnilsen_arthur.pdf` for use in the built website.

## Features

- **Single-page professional CV** with modern typography and design
- **Two-column layout** for optimal space usage and visual balance
- **Auto-populated from website data** - pulls information from `src/_data/personal.js`, `src/_data/dev.js`, `src/_data/gamedev.js`
- **Professional styling** with:
  - **Unified typography system** - Consistent font sizes (11pt base, 22pt name, 14pt sections, 13pt title, 10pt details)
  - **Segoe UI font family** - Professional, modern appearance with anti-aliasing
  - **Consistent color scheme** - Rich orange accent (#d97706) with grayscale text hierarchy
  - **Structured sections** - Clear visual separation with colored borders and proper spacing
  - **Skills** - Clean inline list with dot separators for easy reading
  - **Contact information** - Centered highlight box with LinkedIn, GitHub, website links
  - **Section headers** - Uppercase with colored accent bars and descriptive icons
  - **Combined profile section** - Professional summary and background in one compact section
  - **Awards & recognition** - Prominent display of achievements and awards
  - **Enhanced experience** - Quantifiable achievements and metrics for each role
  - **Curated project selection** - Only highlights most important projects (marked with `onCv: true`)
  - **References statement** - Professional "References available upon request"
  - **Last updated date** - Shows CV currency for recruiters
  - **Full project descriptions** with HTML formatting support (bold text, etc.)
  - **Project tags** - First 3 technology tags displayed before each project title
  - **Rich text content** - supports HTML tags like `<b>`, `<i>`, etc. in descriptions
- **Professional photo** - Includes profile photo in the header for personal branding
- **Optimized for A4 printing** - compact layout with reduced margins for efficient space usage
- **Reliable PDF generation** using html-pdf with consistent results

## Structure

- `generate-cv.js` - Main script that processes data and generates PDF
- `templates/simple-cv-template.html` - Clean HTML template with inline CSS styling

## Dependencies

- `html-pdf` - For PDF generation from HTML
- `fs-extra` - For file operations

## Project Selection

Projects are selectively included in the CV based on the `onCv` boolean field in your project data:

- Set `"onCv": true` for projects you want to highlight in your CV
- Set `"onCv": false` or omit the field for projects to exclude
- Only projects marked as important will appear in the generated PDF

## Customization

To modify the CV layout or styling, edit the `templates/simple-cv-template.html` file. The template uses placeholders like `{{name}}`, `{{contact}}`, etc. that are automatically replaced with data from your website.

To control which projects appear, edit the `onCv` field in your `src/_data/dev.js` and `src/_data/gamedev.js` files.

The design features:
- Clean header with name and title
- Centered contact information
- Two-column layout for experience/education and skills/languages
- Projects section at the bottom
- Professional color scheme and typography