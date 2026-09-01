import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

/**
 * Isolated ImagePicker diagnostic — does NOT use Create Listing helpers.
 * Temporary tool to prove Expo Go / Simulator asset behavior.
 */
export default function ImagePickerDiagnosticScreen({ navigation }) {
  const [log, setLog] = useState('');

  const append = (line) => {
    console.info('[picker-diag]', line);
    setLog((prev) => `${prev}${typeof line === 'string' ? line : JSON.stringify(line, null, 2)}\n\n`);
  };

  const runIsolatedPick = async (label, options) => {
    append(`===== ${label} =====`);
    append({ options });
    try {
      const result = await ImagePicker.launchImageLibraryAsync(options);
      append({
        status: 'RESOLVED',
        canceled: result.canceled,
        assetCount: result.assets?.length || 0,
        assets: (result.assets || []).map((asset, index) => ({
          index,
          uri: asset.uri,
          scheme: asset.uri ? String(asset.uri).split(':')[0] : null,
          assetId: asset.assetId,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          type: asset.type,
        })),
      });
      Alert.alert(
        'Picker resolved',
        result.canceled
          ? 'Canceled'
          : `JS received ${result.assets?.length || 0} asset(s)`
      );
    } catch (error) {
      append({
        status: 'REJECTED_BEFORE_ASSETS',
        code: error?.code,
        message: error?.message,
        cause: error?.cause ? String(error.cause) : null,
        name: error?.name,
        stack: error?.stack,
      });
      Alert.alert(
        'Picker rejected before JS assets',
        `${error?.code || 'NO_CODE'}\n${error?.message || String(error)}`
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ImagePicker Diagnostic</Text>
        <TouchableOpacity onPress={() => setLog('')}>
          <Text style={styles.link}>Clear</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Isolated launchImageLibraryAsync tests. Create Listing is untouched.
        Prefer the newly imported solid blue JPEG / solid red PNG in Photos.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          runIsolatedPick('STEP1 single no-edit', {
            mediaTypes: ['images'],
            allowsEditing: false,
            allowsMultipleSelection: false,
            selectionLimit: 1,
          })
        }
      >
        <Text style={styles.buttonText}>1) Single select (no edit)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          runIsolatedPick('single + current representation', {
            mediaTypes: ['images'],
            allowsEditing: false,
            allowsMultipleSelection: false,
            selectionLimit: 1,
            quality: 1,
            preferredAssetRepresentationMode: 'current',
          })
        }
      >
        <Text style={styles.buttonText}>2) Single + quality1 + current</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          runIsolatedPick('multi select', {
            mediaTypes: ['images'],
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: 5,
            quality: 1,
            preferredAssetRepresentationMode: 'current',
          })
        }
      >
        <Text style={styles.buttonText}>3) Multi select (up to 5)</Text>
      </TouchableOpacity>

      <ScrollView style={styles.logBox}>
        <Text style={styles.logText}>{log || 'Run a test. Results appear here and in Metro.'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontWeight: '700', fontSize: 16 },
  link: { color: '#0A66C2', fontWeight: '600' },
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    color: '#555',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#0A66C2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  logBox: {
    flex: 1,
    margin: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f7f7f7',
  },
  logText: { fontFamily: 'Courier', fontSize: 11, color: '#111' },
});
