import * as ImageManipulator from 'expo-image-manipulator';

/**
 * iOS Photo Library defaults to HEIC. The listing upload API only accepts
 * JPEG / PNG / WEBP (extension + MIME). Prefer a compatible representation
 * from the picker, then transcode anything still HEIC/HEIF (or otherwise
 * unsupported) to JPEG before upload.
 *
 * preferredAssetRepresentationMode: 'compatible' maps to
 * UIImagePickerPreferredAssetRepresentationMode.Compatible on iOS.
 */
export const LISTING_IMAGE_PICKER_OPTIONS = {
  mediaTypes: ['images'],
  allowsMultipleSelection: true,
  quality: 0.8,
  allowsEditing: false,
  preferredAssetRepresentationMode: 'compatible',
};

const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp)$/i;
const ALLOWED_EXT = /^(jpe?g|png|webp)$/i;

function stripQuery(value = '') {
  return decodeURIComponent(String(value).split('?')[0]);
}

function extensionOf(nameOrUri = '') {
  const match = /\.([a-z0-9]+)$/i.exec(stripQuery(nameOrUri));
  return match ? match[1].toLowerCase() : '';
}

function mimeFromExtension(ext) {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return null;
}

function isHeicLike({ uri, fileName, mimeType }) {
  const mime = String(mimeType || '').toLowerCase();
  const ext = extensionOf(fileName || uri);
  return (
    mime.includes('heic') ||
    mime.includes('heif') ||
    ext === 'heic' ||
    ext === 'heif'
  );
}

function isUploadSafe({ name, type }) {
  const ext = extensionOf(name);
  return ALLOWED_EXT.test(ext) && ALLOWED_MIME.test(type);
}

/**
 * Normalize a picker asset into a multipart-safe { uri, name, type }.
 * HEIC/HEIF and other unsupported formats are re-encoded to JPEG.
 */
export async function normalizeListingImageAsset(asset, index = 0) {
  if (!asset?.uri) {
    throw new Error('Invalid image asset');
  }

  const sourceUri = asset.uri;
  const sourceName =
    asset.fileName ||
    stripQuery(sourceUri).split('/').pop() ||
    `photo_${index}.jpg`;
  const sourceMime =
    asset.mimeType ||
    mimeFromExtension(extensionOf(sourceName)) ||
    mimeFromExtension(extensionOf(sourceUri)) ||
    '';

  const candidate = {
    uri: sourceUri,
    name: stripQuery(sourceName),
    type: sourceMime || 'application/octet-stream',
  };

  if (!isHeicLike({ uri: sourceUri, fileName: sourceName, mimeType: sourceMime }) &&
      isUploadSafe(candidate)) {
    return candidate;
  }

  // Transcode via ImageIO (handles HEIC on iOS) into a JPEG the API accepts.
  const converted = await ImageManipulator.manipulateAsync(
    sourceUri,
    [],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  return {
    uri: converted.uri,
    name: `listing_${Date.now()}_${index}.jpg`,
    type: 'image/jpeg',
  };
}

/**
 * Build multipart FormData for POST /upload/listing-images.
 * Accepts local file URIs or picker-like { uri, fileName?, mimeType? } objects.
 */
export async function appendListingImagesToFormData(formData, localImages) {
  for (let index = 0; index < localImages.length; index += 1) {
    const item = localImages[index];
    const asset = typeof item === 'string' ? { uri: item } : item;
    const part = await normalizeListingImageAsset(asset, index);
    formData.append('images', {
      uri: part.uri,
      name: part.name,
      type: part.type,
    });
  }
  return formData;
}
