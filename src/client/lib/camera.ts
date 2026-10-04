export interface CameraManager {
  stream: MediaStream | null;
  start: (videoEl: HTMLVideoElement) => Promise<MediaStream>;
  captureWithoutStop: (videoEl: HTMLVideoElement) => Promise<string>;
  captureAndStop: (videoEl: HTMLVideoElement) => Promise<string>;
  stop: () => void;
}

export function createCameraManager(): CameraManager {
  let activeStream: MediaStream | null = null;

  const start = async (videoEl: HTMLVideoElement): Promise<MediaStream> => {
    // Stop any existing stream first
    stop();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API is not supported on this browser or connection. Note that mobile browsers require HTTPS for direct webcam access; use the Snap Photo fallback button if you are on HTTP.');
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    activeStream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();
    return stream;
  };

  const grabFrame = (videoEl: HTMLVideoElement): string => {
    if (!videoEl.videoWidth || !videoEl.videoHeight) {
      throw new Error('Camera preview is not ready yet. Please wait a moment.');
    }

    const canvas = document.createElement('canvas');
    const maxDim = 1920;
    let width = videoEl.videoWidth;
    let height = videoEl.videoHeight;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context could not be created.');
    }

    ctx.drawImage(videoEl, 0, 0, width, height);

    // Convert to high-quality JPEG (0.88 quality)
    return canvas.toDataURL('image/jpeg', 0.88);
  };

  // Continuous mode: grabs frame but KEEPS CAMERA STREAM ACTIVE
  const captureWithoutStop = async (videoEl: HTMLVideoElement): Promise<string> => {
    return grabFrame(videoEl);
  };

  // One-shot mode: grabs frame and stops stream
  const captureAndStop = async (videoEl: HTMLVideoElement): Promise<string> => {
    const dataUrl = grabFrame(videoEl);
    stop();
    return dataUrl;
  };

  const stop = () => {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping track:', e);
        }
      });
      activeStream = null;
    }
  };

  return {
    get stream() {
      return activeStream;
    },
    start,
    captureWithoutStop,
    captureAndStop,
    stop,
  };
}

export function processFileInput(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1920;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context error'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Request screen wake lock so the phone screen doesn't go to sleep while pointed at laptop
export async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  if ('wakeLock' in navigator && navigator.wakeLock) {
    try {
      return await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
  }
  return null;
}
