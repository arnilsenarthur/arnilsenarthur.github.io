module.exports = function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy({ "src/static/css": "css" });
    eleventyConfig.addPassthroughCopy({ "src/static/js": "js" });
    // Images are handled by optimize-images.js
    eleventyConfig.addPassthroughCopy({ "src/static/3d": "3d" });
    eleventyConfig.addPassthroughCopy({ "src/static/arnilsen_arthur.pdf": "arnilsen_arthur.pdf" });

    // Configure directory structure
    return {
        dir: {
            input: "src",
            output: "dist",
            includes: "_includes"
        }
    };
};
