import React, { useState, useEffect } from 'react';
import { DesktopView } from './components/DesktopView.js';
import { PhoneCameraView } from './components/PhoneCameraView.js';

export const App: React.FC = () => {
  const [route, setRoute] = useState<{ isCamera: boolean; sessionId: string }>({
    isCamera: false,
    sessionId: '',
  });

  useEffect(() => {
    const checkRoute = () => {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const session = searchParams.get('session') || '';

      if (pathname.includes('/camera') || searchParams.has('session')) {
        setRoute({
          isCamera: true,
          sessionId: session.toUpperCase(),
        });
      } else {
        setRoute({
          isCamera: false,
          sessionId: '',
        });
      }
    };

    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  if (route.isCamera) {
    return <PhoneCameraView sessionId={route.sessionId} />;
  }

  return <DesktopView />;
};
