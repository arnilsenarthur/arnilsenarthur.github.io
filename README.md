# Árnilsen Arthur Portfolio - Static Site Generator

This portfolio website now uses Eleventy (11ty) as a static site generator to make content management easier and more maintainable.

## Project Structure

```
├── src/                    # Source files
│   ├── _data/             # Data files (JavaScript modules)
│   │   ├── personal.js    # Personal info, bio, contact details
│   │   ├── projects.js    # Projects data (libraries, college, systems, misc)
│   │   ├── skills.js      # Skills data (networking, development, languages, communication)
│   │   └── timeline.js    # Career timeline data
│   ├── _includes/         # Template partials
│   │   ├── layout.njk     # Main HTML layout
│   │   └── timeline.njk   # Timeline generation script
│   └── index.njk          # Main page template
├── dist/                  # Generated static site (build output)
├── css/                   # Stylesheets
├── js/                    # JavaScript files
├── img/                   # Images
├── .eleventy.js          # Eleventy configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation
```bash
npm install
```

### Development
Start the development server with live reloading:
```bash
npm run dev
```
The site will be available at `http://localhost:8080`

### Build for Production
```bash
npm run build
```
This generates the static site in the `dist/` directory.

### Clean Build
```bash
npm run clean
```

## Content Management

### Adding/Editing Projects
Edit `src/_data/projects.js` to add or modify project information. The structure supports different categories:
- `libraries`: Your code libraries/packages
- `college`: Academic projects
- `systems`: Business systems you've built
- `misc`: Miscellaneous projects (GitHub repos, etc.)

### Updating Skills
Modify `src/_data/skills.js` to update your skill levels and categories.

### Timeline Updates
Edit `src/_data/timeline.js` to add new career milestones or update existing ones.

### Personal Information
Update `src/_data/personal.js` for bio, contact info, and social links.

## Project Filtering

Your portfolio now includes a filtering system for projects! The projects section features filter buttons that allow visitors to view projects by category:

- **All**: Shows all projects
- **Libraries**: Shows your code libraries (like NetBuff)
- **College**: Shows academic projects
- **Systems**: Shows business systems you've built
- **Misc**: Shows miscellaneous projects and experiments

The filtering works with smooth animations and maintains the existing design aesthetic.

## Benefits of Using Eleventy

1. **Content Separation**: Content is now stored in structured data files instead of hardcoded HTML
2. **Maintainability**: Easy to update content without touching HTML
3. **Consistency**: Templates ensure consistent formatting across sections
4. **Performance**: Static generation means fast loading times
5. **Version Control**: Content changes are easier to track and review

## Deployment

The generated `dist/` folder contains your complete static website ready for deployment to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

## Adding New Content Types

To add new sections to your portfolio:

1. Add data to the appropriate `_data/*.js` file
2. Update the template in `src/index.njk` to render the new data
3. Test with `npm run dev`

## Troubleshooting

If you encounter issues:
1. Clear the build cache: `npm run clean && npm run build`
2. Check for syntax errors in data files
3. Ensure all required fields are present in data objects

## Migration Notes

This setup maintains all existing functionality while making content management much easier. The JavaScript files (animations, game, etc.) remain unchanged and continue to work as before.