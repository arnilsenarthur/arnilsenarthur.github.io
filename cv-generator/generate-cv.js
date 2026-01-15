const pdf = require('html-pdf');
const fs = require('fs-extra');
const path = require('path');

function generateCV() {
    try {
        console.log('🚀 Starting simple CV generation...');

        const personalData = require('../src/_data/personal.js');
        const cvData = personalData.cv || {};
        const devData = require('../src/_data/dev.js');
        const gamedevData = require('../src/_data/gamedev.js');

        const templatePath = path.join(__dirname, 'templates', 'simple-cv-template.html');
        const htmlTemplate = fs.readFileSync(templatePath, 'utf8');

        // Helper functions
        const escapeHtml = (value) => {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const stripHtml = (value) => {
            return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        };

        // Get top skills
        const getTopSkills = () => {
            const skills = [];

            // From dev data
            Object.values(devData.skills || {}).forEach(category => {
                category.forEach(skill => {
                    if (skill.title) skills.push(skill.title);
                });
            });

            // Add game dev skills
            skills.push('Unity 3D', 'C# Game Development', 'Multiplayer Networking', 'Game Physics');

            return [...new Set(skills)].slice(0, 10);
        };

        // Generate contact info
        const generateContact = () => {
            return (cvData.contact || []).slice(0, 3).map(contact => {
                const icon = contact.type === 'email' ? '✉' :
                           contact.type === 'phone' ? '📞' :
                           contact.type === 'github' ? '🐙' :
                           contact.type === 'website' ? '🌐' : '📍';
                return `<span class="contact-item">${icon} ${escapeHtml(contact.text)}</span>`;
            }).join(' | ');
        };

        // Generate experience
        const generateExperience = () => {
            const experiences = (cvData.experience || []).slice(0, 4);
            return experiences.map(exp =>
                `<div class="experience-item">
                    <div><strong class="job-title">${escapeHtml(exp.title)}</strong></div>
                    <div class="company">${escapeHtml(exp.org)} (${escapeHtml(exp.years)})</div>
                </div>`
            ).join('');
        };

        // Generate education
        const generateEducation = () => {
            return (cvData.degree || []).slice(0, 2).map(edu =>
                `<div class="education-item">
                    <div><strong>${escapeHtml(edu.title)}</strong></div>
                    <div class="school">${escapeHtml(edu.org)} (${escapeHtml(edu.years)})</div>
                </div>`
            ).join('');
        };

        // Generate skills
        const generateSkills = () => {
            return getTopSkills().map(skill =>
                `<span class="skill-tag">${escapeHtml(skill)}</span>`
            ).join('');
        };

        // Generate projects
        const generateProjects = () => {
            // Combine projects from both dev and gamedev, filter by onCv flag
            const allProjects = [
                ...(devData.projects || []).map(p => ({ ...p, category: 'dev' })),
                ...(gamedevData.projects || []).map(p => ({ ...p, category: 'gamedev' }))
            ].filter(project => project.onCv === true);

            return allProjects.map(project => {
                const description = Array.isArray(project.description)
                    ? project.description[0]
                    : project.description || '';

                // Get first 3 tags
                const tags = (project.tags || []).slice(0, 3).map(tag =>
                    `<span class="skill-tag">${escapeHtml(tag.name || tag)}</span>`
                ).join('');

                return `<div class="project-item">
                    <div class="project-title">${escapeHtml(project.title)}&ensp;${tags}</div>
                    <div class="project-description">${description}</div>
                </div>`;
            }).join('');
        };

        // Generate languages
        const generateLanguages = () => {
            return (cvData.spokenLanguages || []).map(lang =>
                `<div class="language-item">${escapeHtml(lang.name)} - ${escapeHtml(lang.level)}</div>`
            ).join('');
        };

        // Generate awards
        const generateAwards = () => {
            return (cvData.awards || []).map(award =>
                `<div class="award-item">
                    <div class="award-title">${escapeHtml(award.title)}</div>
                    <div class="award-org">${escapeHtml(award.org)} (${escapeHtml(award.year)})</div>
                </div>`
            ).join('');
        };

        // Generate enhanced experience with achievements
        const generateExperienceEnhanced = () => {
            return (cvData.experience || []).map(exp => {
                const achievements = (exp.achievements || []).map(achievement =>
                    `<div class="achievement">• ${escapeHtml(achievement)}</div>`
                ).join('');

                return `<div class="experience-item">
                    <div><strong class="job-title">${escapeHtml(exp.title)}</strong></div>
                    <div class="company">${escapeHtml(exp.org)} (${escapeHtml(exp.years)})</div>
                    ${achievements ? `<div class="experience-achievements">${achievements}</div>` : ''}
                </div>`;
            }).join('');
        };

        // Prepare data for template
        const templateData = {
            name: escapeHtml(personalData.name || ''),
            title: escapeHtml(cvData.subtitle || 'Game Developer & Full Stack Developer'),
            professionalSummary: escapeHtml(cvData.professionalSummary || ''),
            about: (cvData.about || []).slice(0, 2).join(' '),
            contact: generateContact(),
            skills: generateSkills(),
            experience: generateExperienceEnhanced(),
            education: generateEducation(),
            awards: generateAwards(),
            projects: generateProjects(),
            languages: generateLanguages(),
            lastUpdated: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        };

        // Replace template placeholders
        let finalHtml = htmlTemplate;
        Object.keys(templateData).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            finalHtml = finalHtml.replace(regex, templateData[key]);
        });

        // Generate PDF using html-pdf
        console.log('📄 Generating simple CV PDF...');
        const pdfPath = path.join(__dirname, '..', 'src', 'static', 'arnilsen_arthur.pdf');

        const options = {
            format: 'A4',
            orientation: 'portrait',
            border: '20mm',
            type: 'pdf',
            quality: '100',
            printBackground: true,
            renderDelay: 1000
        };

        return new Promise((resolve, reject) => {
            pdf.create(finalHtml, options).toFile(pdfPath, (err, result) => {
                if (err) {
                    console.error('❌ Error generating CV:', err.message);
                    reject(err);
                    return;
                }

                console.log(`✅ CV generated successfully! Saved to: ${pdfPath}`);
                console.log('📁 File location:', path.resolve(pdfPath));
                resolve(result);
            });
        });

    } catch (error) {
        console.error('❌ Error generating modern CV:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

// Run the generator
if (require.main === module) {
    generateCV().catch(() => process.exit(1));
}

module.exports = { generateCV };