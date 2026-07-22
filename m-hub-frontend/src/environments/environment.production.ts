export const environment = {
  production: true,
  mapboxToken: '', // token will be injected during build time from .env file
  logo: '/assets/images/mhub_logo_grey.svg', // overridden at build time from LOGO_PATH
  hideNameSection: false, // overridden at build time from HIDE_NAME_SECTION
  // Empty = the plan tool is served under m-hub's own origin (relative launch,
  // no CORS). Set an absolute URL here if the tool lives on another origin.
  planToolUrl: ''
};