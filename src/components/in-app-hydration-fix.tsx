// This file is no longer used.
// Facebook in-app browser fixes are now handled by:
// 1. Removing framer-motion `initial={{ opacity: 0 }}` from SSR-visible components
// 2. CSS `@supports` fallback for backdrop-filter in glass class
// 3. No loader overlay (content is visible in SSR by default)
