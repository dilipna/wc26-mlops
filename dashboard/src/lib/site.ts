// Product/site identity, centralized so it's set in one place rather than
// duplicated across components. PRODUCT_NAME is the platform brand;
// ACTIVE_SPORT names the one sport plugin currently live on the platform
// (see PROJECT_BRAIN.md §11 -- football is the first of what's meant to be
// several). REPO is deliberately unchanged from the original project name:
// renaming the GitHub repo/Vercel project is a separate, high-blast-radius
// decision, not folded into this branding pass.
export const PRODUCT_NAME = "SpOps";
export const ACTIVE_SPORT = "football";
export const REPO = "dilipna/wc26-mlops";
export const GITHUB_URL = `https://github.com/${REPO}`;
