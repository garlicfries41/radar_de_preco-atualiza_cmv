/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // HelloBonsai Style (Clean, Green, Minimal)
                background: '#F3F4F6', // Gray-100
                surface: '#FFFFFF',    // White
                surfaceHighlight: '#F9FAFB', // Gray-50
                primary: '#00B289',    // Bonsai Green
                primaryHover: '#009e7a',
                secondary: '#2C3E50',  // Dark Text
                textData: '#4B5563',   // Gray-600
                border: '#E5E7EB',     // Gray-200
            },
        },
    },
    plugins: [],
}
