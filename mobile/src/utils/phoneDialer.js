/**
 * Open the system phone dialer for a Jordanian mobile number.
 *
 * Never call Linking.openURL('tel:…') on the iOS Simulator — React Native
 * logs a yellow-box warning from RCTLinkingManager.mm because there is no
 * Phone app ("Unable to open the Phone app in the simulator for telephone URLs").
 */

import { Linking, Platform, Settings } from 'react-native';
import { formatPhoneNumber, isValidPhoneNumber } from './phone';
import { showToast } from './toast';

const DEFAULT_UNAVAILABLE = 'Seller phone number is unavailable.';

function isIosSimulator() {
  if (Platform.OS !== 'ios') return false;
  // Set in AppDelegate.swift via #if targetEnvironment(simulator).
  return Settings.get('telefonak_is_simulator') === true;
}

/**
 * @param {string|null|undefined} phoneNumber
 * @param {{ unavailableMessage?: string, dialerUnavailableMessage?: string }} [options]
 * @returns {Promise<boolean>} true if the dialer was opened
 */
export async function openPhoneDialer(phoneNumber, options = {}) {
  const unavailableMessage = options.unavailableMessage || DEFAULT_UNAVAILABLE;
  const dialerUnavailableMessage =
    options.dialerUnavailableMessage || unavailableMessage;

  const normalized = formatPhoneNumber(phoneNumber);
  if (!isValidPhoneNumber(normalized)) {
    showToast(unavailableMessage);
    return false;
  }

  const url = `tel:${normalized}`;

  // Root cause of the LogBox warning: openURL(tel:) on iOS Simulator.
  if (isIosSimulator()) {
    showToast(dialerUnavailableMessage);
    return false;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      showToast(dialerUnavailableMessage);
      return false;
    }
  } catch {
    // Scheme not declared in LSApplicationQueriesSchemes yet (stale binary).
    // Still attempt openURL on a real device.
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    showToast(dialerUnavailableMessage);
    return false;
  }
}
