// Background image handling for the setup screen. Kept out of the store so the
// store stays free of DOM APIs (FileReader / Image / canvas).

export const DEFAULT_BACKGROUND_URL =
  'https://github.com/user-attachments/assets/5049342e-62fa-4d84-8611-83794be2216f'

// Files at or below this size are stored verbatim; larger ones are downscaled to
// a JPEG so the base64 string stays comfortably inside the localStorage quota.
export const MAX_STORED_BYTES = 3 * 1024 * 1024
export const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.82

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image file.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode the image file.'))
    image.src = src
  })
}

async function downscaleToJpegDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not process the image.')
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function fileToBackgroundDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  if (file.size <= MAX_STORED_BYTES) {
    return readAsDataUrl(file)
  }

  return downscaleToJpegDataUrl(file)
}

export function isValidBackgroundValue(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value)
}
