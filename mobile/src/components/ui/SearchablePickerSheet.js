import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { fonts, radii, space } from '../../utils/designTokens';
import { BottomSheet } from './BottomSheet';
import { SelectionList, SelectionListItem } from './SelectionList';
import {
  POPULAR_BRAND_NAMES,
  matchesBrandQuery,
  buildBrandPickerSections,
} from '../../utils/brandPickerLayout';

const EMPTY_LIST = [];

/**
 * Searchable option list inside a bottom sheet.
 * options: [{ id, label, ... }]
 *
 * variant="brand" adds Popular / All Brands sections and an optional
 * manual-entry footer. Default variant uses the same grouped list rows.
 */
export function SearchablePickerSheet({
  open,
  onClose,
  title,
  options = [],
  selectedId,
  onSelect,
  searchable = true,
  searchPlaceholder = 'Search…',
  emptyText = 'No results',
  variant = 'list',
  popularNames = POPULAR_BRAND_NAMES,
  popularHeader = 'POPULAR BRANDS',
  allHeader = 'ALL BRANDS',
  manualEntry,
}) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const [query, setQuery] = useState('');
  const isBrandLayout = variant === 'brand';

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return options;
    return options.filter((opt) => matchesBrandQuery(opt.label, q));
  }, [options, q]);

  const { popular: popularOptions, all: allOptions, isSearching } = useMemo(() => {
    if (!isBrandLayout) {
      return { popular: [], all: filtered, isSearching: q.length > 0 };
    }
    return buildBrandPickerSections(options, {
      query,
      popularNames,
      manualId: manualEntry?.id,
    });
  }, [isBrandLayout, filtered, options, query, popularNames, manualEntry, q]);

  const selectItem = (item) => {
    onSelect?.(item);
    onClose?.();
  };

  const renderGroupedItem = (item, index, list) => (
    <SelectionListItem
      label={item.label}
      selected={String(item.id) === String(selectedId)}
      showDivider={index < list.length - 1}
      onPress={() => selectItem(item)}
    />
  );

  const listHeader = isBrandLayout ? (
    <View>
      {popularOptions.length > 0 ? (
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionHeader,
              {
                color: colors.textMuted,
                textAlign: isRTL ? 'right' : 'left',
                letterSpacing: isRTL ? 0 : 0.6,
              },
            ]}
          >
            {popularHeader}
          </Text>
          <SelectionList>
            {popularOptions.map((item, index) => (
              <SelectionListItem
                key={`popular-${item.id}`}
                label={item.label}
                selected={String(item.id) === String(selectedId)}
                showDivider={index < popularOptions.length - 1}
                onPress={() => selectItem(item)}
              />
            ))}
          </SelectionList>
        </View>
      ) : null}
      {allOptions.length > 0 ? (
        <View style={[styles.section, popularOptions.length > 0 && styles.sectionSpaced]}>
          {!isSearching ? (
            <Text
              style={[
                styles.sectionHeader,
                {
                  color: colors.textMuted,
                  textAlign: isRTL ? 'right' : 'left',
                  letterSpacing: isRTL ? 0 : 0.6,
                },
              ]}
            >
              {allHeader}
            </Text>
          ) : null}
          <SelectionList>
            {allOptions.map((item, index) => (
              <SelectionListItem
                key={`all-${item.id}`}
                label={item.label}
                selected={String(item.id) === String(selectedId)}
                showDivider={index < allOptions.length - 1}
                onPress={() => selectItem(item)}
              />
            ))}
          </SelectionList>
        </View>
      ) : null}
    </View>
  ) : null;

  const listFooter = isBrandLayout && manualEntry ? (
    <View
      style={[
        styles.manualCard,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={[styles.manualIconWrap, { backgroundColor: colors.surface }]}>
        <Ionicons name="help-circle-outline" size={28} color={colors.primary} />
      </View>
      <Text
        style={[
          styles.manualTitle,
          { color: colors.text, textAlign: 'center' },
        ]}
      >
        {manualEntry.title}
      </Text>
      <Text
        style={[
          styles.manualBody,
          { color: colors.textSecondary, textAlign: 'center' },
        ]}
      >
        {manualEntry.description}
      </Text>
      <TouchableOpacity
        style={[styles.manualButton, { backgroundColor: colors.primary }]}
        onPress={() => selectItem({ id: manualEntry.id, label: manualEntry.buttonLabel })}
        activeOpacity={0.85}
      >
        <Text style={[styles.manualButtonText, { color: colors.onPrimary }]}>
          {manualEntry.buttonLabel}
        </Text>
      </TouchableOpacity>
    </View>
  ) : null;

  const emptyEl = (
    <Text style={[styles.empty, { color: colors.textSecondary }]}>{emptyText}</Text>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={title} maxHeight="78%">
      {searchable ? (
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.border,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={[
              styles.searchInput,
              { color: colors.text, textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      {isBrandLayout ? (
        <FlatList
          data={EMPTY_LIST}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={allOptions.length > 0 ? null : emptyEl}
          renderItem={() => null}
        />
      ) : filtered.length === 0 ? (
        emptyEl
      ) : (
        <SelectionList style={styles.groupedList}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            extraData={selectedId}
            keyboardShouldPersistTaps="handled"
            style={styles.groupedFlatList}
            renderItem={({ item, index }) => renderGroupedItem(item, index, filtered)}
          />
        </SelectionList>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: space[3],
    minHeight: 48,
    marginBottom: space[3],
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingVertical: space[2],
  },
  groupedList: {
    marginBottom: space[2],
    maxHeight: 420,
  },
  groupedFlatList: {
    flexGrow: 0,
    maxHeight: 420,
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    paddingBottom: space[4],
  },
  section: {
    marginBottom: space[2],
  },
  sectionSpaced: {
    marginTop: space[2],
  },
  sectionHeader: {
    fontFamily: fonts.labelBold,
    fontSize: 12,
    letterSpacing: 0.6,
    marginBottom: space[2],
    paddingHorizontal: space[1],
  },
  manualCard: {
    marginTop: space[5],
    borderRadius: radii['2xl'],
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: space[5],
    alignItems: 'center',
  },
  manualIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  manualTitle: {
    fontFamily: fonts.headline,
    fontSize: 16,
    marginBottom: space[2],
  },
  manualBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: space[4],
  },
  manualButton: {
    alignSelf: 'stretch',
    borderRadius: radii.xl,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  manualButtonText: {
    fontFamily: fonts.labelBold,
    fontSize: 15,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: space[6],
  },
});
