/**
 * Lightweight in-app toast — non-blocking, no Alert dialogs.
 * Mount <ToastHost /> once near the app root, then call showToast(message).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import {
  isMaintenanceActive,
  setMaintenanceToastDismisser,
} from './maintenance';

const DEFAULT_DURATION_MS = 2800;
let showToastImpl = null;
let dismissToastImpl = null;

/**
 * @param {string} message
 * @param {{ durationMs?: number }} [options]
 */
export function showToast(message, options = {}) {
  // Maintenance is a full-screen controlled state — never toast over it.
  if (isMaintenanceActive()) return;
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) return;
  if (typeof showToastImpl === 'function') {
    showToastImpl(text, options.durationMs ?? DEFAULT_DURATION_MS);
  }
}

export function dismissToast() {
  if (typeof dismissToastImpl === 'function') {
    dismissToastImpl();
  }
}

export function ToastHost() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);
  const animRef = useRef(null);

  const hide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    animRef.current?.stop();
    animRef.current = Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    });
    animRef.current.start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [opacity]);

  const dismissImmediate = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    animRef.current?.stop();
    opacity.setValue(0);
    setVisible(false);
    setMessage('');
  }, [opacity]);

  const show = useCallback(
    (text, durationMs) => {
      if (isMaintenanceActive()) return;
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      animRef.current?.stop();
      setMessage(text);
      setVisible(true);
      opacity.setValue(0);
      animRef.current = Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      });
      animRef.current.start();
      hideTimerRef.current = setTimeout(hide, durationMs);
    },
    [hide, opacity]
  );

  useEffect(() => {
    showToastImpl = show;
    dismissToastImpl = dismissImmediate;
    setMaintenanceToastDismisser(dismissImmediate);
    return () => {
      if (showToastImpl === show) showToastImpl = null;
      if (dismissToastImpl === dismissImmediate) dismissToastImpl = null;
      setMaintenanceToastDismisser(null);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      animRef.current?.stop();
    };
  }, [show, dismissImmediate]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      <Animated.View style={[styles.toast, { opacity }]}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    maxWidth: 420,
    backgroundColor: 'rgba(26, 28, 28, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  text: {
    fontFamily: 'Inter_400Regular',
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
