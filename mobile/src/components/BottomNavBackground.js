import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const NOTCH_JOIN_HALF_WIDTH = 32;
const NOTCH_RADIUS = 24;

export default function BottomNavBackground({ color }) {
  const [width, setWidth] = useState(0);

  const handleLayout = useCallback((event) => {
    const nextWidth = event.nativeEvent.layout.width;
    setWidth((currentWidth) =>
      currentWidth === nextWidth ? currentWidth : nextWidth
    );
  }, []);

  const center = width / 2;

  return (
    <View pointerEvents="none" style={styles.container} onLayout={handleLayout}>
      {width ? (
        <>
          <View style={[styles.base, { backgroundColor: color }]} />
          <View
            style={[
              styles.leftShoulder,
              {
                width: center,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.rightShoulder,
              {
                left: center,
                backgroundColor: color,
              },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  base: {
    position: 'absolute',
    top: NOTCH_RADIUS,
    right: 0,
    bottom: 0,
    left: 0,
  },
  leftShoulder: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: NOTCH_RADIUS,
    borderTopRightRadius: NOTCH_JOIN_HALF_WIDTH,
  },
  rightShoulder: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: NOTCH_RADIUS,
    borderTopLeftRadius: NOTCH_JOIN_HALF_WIDTH,
  },
});
