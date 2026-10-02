import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useT } from '@/src/i18n';
import { photoUrl } from '@/src/lib/api';
import { colors, font, radius, spacing } from '@/src/theme';
import type { PhotoRef } from '@/shared/types';

const HEIGHT = 280;

export function PhotoCarousel({ photos }: { photos: PhotoRef[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const t = useT();

  if (photos.length === 0) {
    return (
      <View style={[styles.placeholder, { width }]}>
        <Ionicons name="image-outline" size={40} color={colors.textFaint} />
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={photos}
        keyExtractor={(p) => p.name}
        horizontal
        pagingEnabled
        // Chaque photo affichée est facturée par Google : on ne charge que la photo
        // visible et ses voisines, pas les 6 d'un coup.
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => {
          const author = item.attributions[0];
          return (
            <View style={{ width, height: HEIGHT }}>
              <Image
                source={{ uri: photoUrl(item.name, 1200) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
                cachePolicy="memory"
              />
              {author && (
                <Pressable
                  style={styles.credit}
                  onPress={
                    author.uri ? () => void WebBrowser.openBrowserAsync(author.uri!) : undefined
                  }
                  hitSlop={8}
                >
                  <Text style={styles.creditText} numberOfLines={1}>
                    {t('Photo : {author}', { author: author.displayName })}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((p, i) => (
            <View key={p.name} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: HEIGHT / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  credit: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    maxWidth: '70%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  creditText: { color: '#FFFFFF', fontSize: font.tiny },
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#FFFFFF' },
});
