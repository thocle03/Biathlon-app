/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Custom premium palette can be added here
                biathlon: {
                    dark: '#0f172a',    // Slate 900
                    primary: '#3b82f6', // Blue 500
                    accent: '#ef4444',  // Red 500 (for missed shots)
                    snow: '#f8fafc',    // Slate 50
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
