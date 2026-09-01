import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts, radii, space } from '../../utils/designTokens';

/**
 * Label-above text field with ghost border and primary focus aura.
 * React 19: `ref` is a normal prop (no forwardRef — Fabric treats that as an Object).
 */
export function TextField({
  ref,
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  editable = true,
  multiline = false,
  style,
  inputStyle,
  ...rest
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            backgroundColor: colors.inputBackground,
            color: colors.text,
            borderColor: error
              ? colors.error
              : focused
                ? colors.primary
                : colors.inputBorder,
            shadowColor: focused ? colors.primary : 'transparent',
            shadowOpacity: focused ? 1 : 0,
            shadowRadius: focused ? 4 : 0,
            shadowOffset: { width: 0, height: 0 },
          },
          inputStyle,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 14,
    marginBottom: space[2],
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 48,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: space[1],
  },
});
