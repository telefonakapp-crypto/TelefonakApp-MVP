import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Create/Edit Listing photo picker options.
 *
 * Multi-select requires allowsEditing: false (PHPicker on iOS).
 * quality: 1 + preferredAssetRepresentationMode: 'current' asks Expo for the
 * original asset file instead of a synthesized public.jpeg representation.
 *
 * HEIC → JPEG conversion happens only in normalizeListingImageAsset() at submit.
 */
export const LISTING_IMAGE_PICKER_OPTIONS = {
  mediaTypes: ['images'],
  allowsMultipleSelection: true,
  allowsEditing: false,
  quality: 1,
  preferredAssetRepresentationMode: 'current',
};

const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp)$/i;
const ALLOWED_EXT = /^(jpe?g|png|webp)$/i;
const MAX_LISTING_IMAGES = 10;

export function isListingImageRepresentationError(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('Cannot load representation') ||
    message.includes('Failed to read picked image') ||
    error?.code === 'ERR_FAILED_TO_READ_IMAGE'
  );
}

export function getListingImagePickerErrorMessage(error) {
  if (isListingImageRepresentationError(error)) {
    // Expo Go ships its own native image-picker binary, so our MediaHandler
    // patch only applies in the Telefonak native build (`npm run ios:native`).
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return 'Could not read the selected photo(s). If you are on Expo Go in the iOS Simulator, run the native app instead (`npm run ios:native`), or pick a real imported JPEG/PNG rather than the Simulator’s default sample photos.';
    }
    return 'We could not read one or more selected photos. Please try again or choose different images.';
  }
  return 'We could not access the selected photo. Please try again or choose another image.';
}

export function mapPickerAssetsToListingImages(assets = []) {
  return assets
    .filter((asset) => Boolean(asset?.uri))
    .map((asset) => ({
      uri: asset.uri,
      assetId: asset.assetId || null,
      fileName: asset.fileName,
      mimeType: asset.mimeType || null,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    }));
}

export function mergeListingImageAssets(
  current = [],
  incoming = [],
  max = MAX_LISTING_IMAGES
) {
  const merged = Array.isArray(current) ? [...current] : [];
  const seen = new Set(
    merged.map((asset) => asset?.assetId || asset?.uri).filter(Boolean)
  );

  for (const asset of incoming) {
    if (merged.length >= max) break;
    const key = asset?.assetId || asset?.uri;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(asset);
  }

  return merged;
}

export function logListingPickerResult(result) {
  console.info('[listing-images] picker result', {
    canceled: result?.canceled,
    assetCount: result?.assets?.length || 0,
    assets: (result?.assets || []).map((asset, index) => ({
      index,
      assetId: asset?.assetId ?? null,
      uri: asset?.uri ?? null,
      fileName: asset?.fileName ?? null,
      mimeType: asset?.mimeType ?? null,
      width: asset?.width ?? null,
      height: asset?.height ?? null,
      fileSize: asset?.fileSize ?? null,
      type: asset?.type ?? null,
      hasBase64: Boolean(asset?.base64),
    })),
  });
}

/**
 * Opens the native library picker (PHPicker on iOS when allowsEditing is false).
 *
 * IMPORTANT: On current Expo Go + iOS Simulator, this call itself can reject with
 * ERR_FAILED_TO_READ_IMAGE / public.jpeg AFTER Choose and BEFORE assets[] is
 * returned to JS. When that happens, no URI reaches mapPickerAssetsToListingImages
 * or the preview state.
 */
export async function launchListingImageLibraryAsync(selectionLimit) {
  const limit = Math.max(0, Number(selectionLimit) || 0);
  if (limit <= 0) {
    return { canceled: true, assets: null };
  }

  const options = {
    ...LISTING_IMAGE_PICKER_OPTIONS,
    selectionLimit: limit,
  };

  console.info('[listing-images] launching ImagePicker', options);

  try {
    const result = await ImagePicker.launchImageLibraryAsync(options);

    // If we reach here, native returned a JS result (success or cancel).
    console.info('[listing-images] CASE A path: native returned a result object');
    logListingPickerResult(result);

    if (!result.canceled && result.assets?.length) {
      result.assets.forEach((asset, index) => {
        const uri = String(asset?.uri || '');
        console.info('[listing-images] raw asset URI scheme', {
          index,
          uri,
          scheme: uri.includes(':') ? uri.split(':')[0] : null,
        });
      });
    }

    return result;
  } catch (error) {
    // CASE B: native rejected inside launchImageLibraryAsync.
    // No result.assets / no URI exists for preview or FileSystem/ImageManipulator.
    console.warn(
      '[listing-images] CASE B: ImagePicker.launchImageLibraryAsync rejected before returning assets',
      {
        code: error?.code,
        message: error?.message,
        name: error?.name,
      }
    );
    throw error;
  }
}

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
 * Called at submit time only — not during picker preview.
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

  if (
    !isHeicLike({ uri: sourceUri, fileName: sourceName, mimeType: sourceMime }) &&
    isUploadSafe(candidate)
  ) {
    return candidate;
  }

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
