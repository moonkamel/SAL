import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useT } from '@/src/i18n';
import { colors } from '@/src/theme';

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const t = useT();
  return (
    <View
      style={{ flexDirection: 'row', gap: 1 }}
      accessibilityLabel={t('{n} étoiles sur 5', { n: rating })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={colors.star}
        />
      ))}
    </View>
  );
}
