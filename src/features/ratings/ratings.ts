import AsyncStorage from '@react-native-async-storage/async-storage';

// Notes données par l'utilisateur dans l'app : nos propres données, indexées par place_id.
const KEY = 'ratings:v1';

export async function getRatings(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export async function saveRating(placeId: string, rating: number): Promise<void> {
  const ratings = await getRatings();
  ratings[placeId] = rating;
  await AsyncStorage.setItem(KEY, JSON.stringify(ratings)).catch(() => {});
}
