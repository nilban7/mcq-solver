import { ImageQualityResult } from '../shared/types.js';

export function validateBase64Image(dataUrl: string): ImageQualityResult {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { valid: false, error: 'No image data received.' };
  }

  // Expecting data:image/jpeg;base64,... or data:image/png;base64,... or data:image/webp;base64,...
  const match = dataUrl.match(/^data:(image\/(jpeg|png|webp|jpg));base64,(.+)$/i);
  if (!match) {
    return { valid: false, error: 'Unsupported format. Expected JPEG, PNG, or WebP.' };
  }

  const base64Data = match[3];
  // Calculate approximate byte size
  const byteLength = (base64Data.length * 3) / 4;

  // Check minimum size: Less than 2KB is almost certainly a blank/corrupt image
  if (byteLength < 2048) {
    return { valid: false, error: 'Image file is too small or blank. Please capture clearly.' };
  }

  // Maximum size: Cap at 15MB to prevent memory exhaustion
  if (byteLength > 15 * 1024 * 1024) {
    return { valid: false, error: 'Image exceeds maximum allowed size (15MB).' };
  }

  return { valid: true };
}
