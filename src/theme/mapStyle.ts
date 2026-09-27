import { palette } from './index';

// Style de carte Google aux couleurs de l'app : rues bleu nuit, eau profonde,
// libellés pierre et or, points d'intérêt discrets pour laisser ressortir nos épingles.
export const lilleNightMapStyle = JSON.stringify([
  { elementType: 'geometry', stylers: [{ color: '#121731' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: palette.stoneMuted }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0D1C' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: palette.gold }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#14233A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#232A4D' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0E1228' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A2F4A' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: palette.gold }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#2E3658' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: palette.gold }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B1A2E' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: palette.stoneFaint }] },
]);
