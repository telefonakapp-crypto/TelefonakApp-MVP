import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ambientElevation, fonts, radii, space } from '../../utils/designTokens';

/**
 * Presentational bottom sheet shell. Parent controls open + children.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '90%',
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const content = (
    <>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          ambientElevation,
          {
            backgroundColor: colors.surface,
            maxHeight,
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
    </>
  );

  return (
    <Modal visible={!!open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
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
