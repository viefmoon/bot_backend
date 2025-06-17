let isLoading = false;
let isLoaded = false;

export const loadGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('loadGoogleMaps called');
    console.log('API Key:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
    
    // If already loaded, resolve immediately
    if (isLoaded && window.google && window.google.maps) {
      console.log('Google Maps already loaded');
      resolve();
      return;
    }

    // If already loading, wait for it
    if (isLoading) {
      const checkInterval = setInterval(() => {
        if (isLoaded && window.google && window.google.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    isLoading = true;

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        isLoaded = true;
        isLoading = false;
        resolve();
      });
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isLoaded = true;
      isLoading = false;
      resolve();
    };

    script.onerror = (error) => {
      console.error('Failed to load Google Maps script:', error);
      isLoading = false;
      reject(new Error('Failed to load Google Maps - Check API key and enabled APIs'));
    };
    
    // Add global callback to check for auth errors
    (window as any).gm_authFailure = () => {
      console.error('Google Maps authentication failed - Check API key permissions');
      reject(new Error('Google Maps authentication failed'));
    };

    document.head.appendChild(script);
  });
};