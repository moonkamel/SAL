import { View } from 'react-native';

import { AdminPanel } from '@/src/features/admin/AdminPanel';
import { colors } from '@/src/theme';

/** Espace partenaires (navigateur) : bons plans, agenda, sponsorisés, liens partenaires. */
export default function AdminScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AdminPanel />
    </View>
  );
}
