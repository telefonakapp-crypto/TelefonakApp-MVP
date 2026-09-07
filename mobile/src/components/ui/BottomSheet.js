import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ambientElevation, fonts, radii, space } from '../../utils/designTokens';

const OPEN_MS = 320;
const CLOSE_MS = 260;
const OPEN_EASE = Easing.out(Easing.cubic);
const CLOSE_EASE = Easing.in(Easing.cubic);

/**
 * Presentational bottom sheet shell. Parent controls open + children.
 * Modal path (Create Listing) uses native slide. Embedded path (Filters)
 * keeps the same UI but animates in-place so iOS nested modals are avoided.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '90%',
  embedded = false,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [rendered, setRendered] = useState(false);
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const openAnimRef = useRef(null);
  const closeAnimRef = useRef(null);
  const sheetMaxHeight = embedded ? screenHeight * 0.78 : maxHeight;

  useLayoutEffect(() => {
    if (!embedded) return undefined;

    openAnimRef.current?.stop();
    closeAnimRef.current?.stop();

    if (open) {
      if (!rendered) {
        translateY.setValue(screenHeight);
        backdropOpacity.setValue(0);
        setRendered(true);
        return undefined;
      }

      openAnimRef.current = Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: OPEN_MS,
          easing: OPEN_EASE,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: OPEN_MS,
          easing: OPEN_EASE,
          useNativeDriver: true,
        }),
      ]);
      openAnimRef.current.start();
      return () => openAnimRef.current?.stop();
    }

    if (!rendered) return undefined;

    closeAnimRef.current = Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: CLOSE_MS,
        easing: CLOSE_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: CLOSE_EASE,
        useNativeDriver: true,
      }),
    ]);
    closeAnimRef.current.start(({ finished }) => {
      if (finished) setRendered(false);
    });
    return () => closeAnimRef.current?.stop();
  }, [embedded, open, rendered, screenHeight, translateY, backdropOpacity]);

  const sheetInner = (
    <View
      style={[
        styles.sheet,
        ambientElevation,
        {
          backgroundColor: colors.surface,
          maxHeight: sheetMaxHeight,
          paddingBottom: Math.max(insets.bottom, space[4]),
        },
      ]}
    >
      <View style={styles.handleWrap}>
        <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
      </View>
      {title ? (
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );

  if (embedded) {
    if (!rendered) return null;
    return (
      <View
        pointerEvents="auto"
        accessibilityViewIsModal
        collapsable={false}
        style={[
          styles.embeddedRoot,
          {
            width: screenWidth,
            height: screenHeight,
          },
        ]}
      >
        <Animated.View
          pointerEvents={open ? 'auto' : 'none'}
          style={[
            styles.backdrop,
            { backgroundColor: colors.overlay, opacity: backdropOpacity },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[styles.embeddedSheet, { transform: [{ translateY }] }]}
        >
          {sheetInner}
        </Animated.View>
      </View>
    );
  }

  return (
    <Modal
      visible={!!open}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
        />
        {sheetInner}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  embeddedRoot: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  embeddedSheet: {
    width: '100%',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: radii['2xl'] + 8,
    borderTopRightRadius: radii['2xl'] + 8,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: space[2],
    paddingBottom: space[1],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  title: {
    fontFamily: fonts.headline,
    fontSize: 18,
    flex: 1,
    marginRight: space[3],
  },
  body: {
    paddingHorizontal: space[4],
  },
});
