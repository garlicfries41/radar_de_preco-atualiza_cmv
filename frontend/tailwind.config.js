/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Premium Dark Theme (Blast-inspired)
                background: '#050505',
                surface: '#121212',
                surfaceHighlight: '#1E1E1E',
                primary: '#D4FF00', // Neon Lime
                primaryHover: '#B8DE00',
                secondary: '#FFFFFF',
                textData: '#888888',
                border: '#333333',
            },
        },
    },
    plugins: [],
}
