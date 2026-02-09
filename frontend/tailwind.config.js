/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // We will add custom colors here later based on "HelloBonsai" design system
                primary: '#10B981', // Emerald 500 as placeholder
                secondary: '#3B82F6', // Blue 500
                background: '#F3F4F6', // Gray 100
            },
        },
    },
    plugins: [],
}
