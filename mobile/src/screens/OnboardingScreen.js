import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: 'Find Your Perfect Phone',
    description: 'Browse thousands of verified second-hand mobiles at the best prices in Jordan.',
    image: null,
    icon: '📱',
    color: '#ecfeff', // bg-cyan-50
  },
  {
    id: 2,
    title: 'Sell in Seconds',
    description: 'List your device quickly and connect with serious buyers instantly.',
    image: null,
    icon: '💰',
    color: '#fff7ed', // bg-orange-50
  },
  {
    id: 3,
    title: 'Safe & Secure',
    description: 'Verified sellers and secure communication for your peace of mind.',
    image: null,
    icon: '✅',
    color: '#eff6ff', // bg-blue-50
  },
];

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);

  const handleScroll = (event) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentSlide(slideIndex);
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      const nextIndex = currentSlide + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentSlide(nextIndex);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    navigation.replace('AuthChoice');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Skip Button */}
      <View style={styles.skipContainer}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipButton}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Carousel Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => (
          <View key={slide.id} style={styles.slideContainer}>
            <View style={styles.slideContent}>
              <View style={[styles.imageContainer, { backgroundColor: slide.color }]}>
                {slide.image ? (
                  <Image
                    source={slide.image}
                    style={styles.image}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.placeholderIcon}>{slide.icon}</Text>
                )}
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.title}>
                  {slide.title}
                </Text>
                <Text style={styles.description}>
                  {slide.description}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Indicators */}
        <View style={styles.indicatorsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentSlide && styles.indicatorActive,
              ]}
            />
          ))}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          onPress={handleNext}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>
            {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  skipContainer: {
    paddingHorizontal: 24, // p-6 horizontal
    paddingTop: 8, // Reduced top padding
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipButton: {
    color: '#71717a', // text-muted-foreground
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24, // p-6
  },
  slideContent: {
    alignItems: 'center',
    width: '100%',
  },
  imageContainer: {
    width: 256, // w-64
    height: 256, // h-64
    borderRadius: 128, // rounded-full
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32, // p-8
    marginBottom: 16, // mb-4
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderIcon: {
    fontSize: 120,
    textAlign: 'center',
  },
  textContainer: {
    maxWidth: 320, // max-w-xs
    alignSelf: 'center',
    marginTop: 32, // gap-8 equivalent
  },
  title: {
    fontSize: 30, // text-3xl
    fontWeight: 'bold',
    color: '#09090b', // text-foreground
    textAlign: 'center',
    marginBottom: 16, // space-y-4 equivalent
  },
  description: {
    color: '#71717a', // text-muted-foreground
    fontSize: 18, // text-lg
    lineHeight: 28, // leading-relaxed
    textAlign: 'center',
  },
  controlsContainer: {
    padding: 32, // p-8
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32, // space-y-8 equivalent
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#71717a33', // bg-muted-foreground/30
    marginHorizontal: 4, // gap-2 equivalent
  },
  indicatorActive: {
    width: 32, // w-8
    backgroundColor: '#667eea', // bg-primary (using app primary color)
  },
  nextButton: {
    width: '100%',
    height: 56, // h-14
    borderRadius: 16, // rounded-2xl
    backgroundColor: '#667eea', // primary color
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18, // text-lg
    fontWeight: '600',
  },
});
