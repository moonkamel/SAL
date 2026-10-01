// Recettes types : en tapant « Carbonnade » ou « Croque-monsieur », le chef obtient
// les ingrédients habituels du plat, qu'il n'a plus qu'à ajuster.
// Clés en texte normalisé (minuscules, sans accents). La clé la plus longue
// contenue dans le nom du plat gagne (« tartare de saumon » avant « tartare »).

const E = 'Entrées';
const P = 'Plats';
const D = 'Desserts';

export const DISH_PRESETS = {
  // Entrées
  'salade cesar': [E, ['Salade romaine', 'Poulet', 'Parmesan', 'Croûtons', 'Sauce césar (œuf, anchois, moutarde)']],
  'salade nicoise': [E, ['Salade', 'Tomates', 'Thon', 'Œuf dur', 'Anchois', 'Olives', 'Vinaigrette']],
  'chevre chaud': [E, ['Salade', 'Fromage de chèvre', 'Pain', 'Miel', 'Noix', 'Vinaigrette']],
  'salade au maroilles': [E, ['Salade', 'Maroilles', 'Pain', 'Vinaigrette']],
  'soupe a l\'oignon': [E, ['Oignons', 'Bouillon de bœuf', 'Pain', 'Emmental', 'Beurre', 'Farine de blé']],
  'gratinee': [E, ['Oignons', 'Bouillon de bœuf', 'Pain', 'Emmental', 'Beurre', 'Farine de blé']],
  'oeuf mayo': [E, ['Œufs', 'Mayonnaise']],
  'oeufs mayo': [E, ['Œufs', 'Mayonnaise']],
  'os a moelle': [E, ['Os à moelle', 'Pain', 'Fleur de sel']],
  'terrine': [E, ['Terrine de porc', 'Œuf', 'Cognac', 'Cornichons', 'Pain']],
  'foie gras': [E, ['Foie gras', 'Porto', 'Pain brioché']],
  'carpaccio': [E, ['Bœuf', 'Parmesan', 'Huile d\'olive', 'Roquette', 'Citron']],
  'tartare de saumon': [E, ['Saumon', 'Citron', 'Aneth', 'Échalote', 'Huile d\'olive']],
  'burrata': [E, ['Burrata', 'Tomates', 'Pesto', 'Huile d\'olive']],
  'escargots': [E, ['Escargots', 'Beurre', 'Ail', 'Persil']],
  'huitres': [E, ['Huîtres', 'Vinaigre d\'échalote', 'Pain de seigle', 'Beurre']],
  'croquettes de crevettes': [E, ['Crevettes grises', 'Béchamel (lait, farine, beurre)', 'Chapelure', 'Œuf']],
  'gaspacho': [E, ['Tomates', 'Concombre', 'Poivron', 'Pain', 'Huile d\'olive', 'Vinaigre de xérès']],
  'planche de charcuterie': [E, ['Charcuterie', 'Cornichons', 'Pain']],
  'planche de fromages': [E, ['Fromages', 'Pain', 'Noix']],
  'planche mixte': [E, ['Charcuterie', 'Fromages', 'Cornichons', 'Pain']],
  'camembert roti': [E, ['Camembert', 'Pain', 'Miel']],
  'houmous': [E, ['Pois chiches', 'Tahini', 'Citron', 'Ail', 'Huile d\'olive']],
  'velouté': [E, ['Légumes', 'Crème', 'Bouillon de légumes (céleri)']],
  'veloute': [E, ['Légumes', 'Crème', 'Bouillon de légumes (céleri)']],
  'soupe': [E, ['Légumes', 'Bouillon de légumes (céleri)']],
  'bruschetta': [E, ['Pain', 'Tomates', 'Ail', 'Basilic', 'Huile d\'olive']],
  'nems': [E, ['Galette de riz', 'Porc', 'Vermicelles de riz', 'Champignons noirs', 'Sauce nuoc-mâm']],
  'samoussa': [E, ['Feuille de brick (blé)', 'Bœuf', 'Oignons', 'Épices']],
  'calamars': [E, ['Calamars', 'Farine de blé', 'Sauce tartare (mayonnaise, câpres)']],
  'accras': [E, ['Morue', 'Farine de blé', 'Œuf', 'Piment']],
  'tapenade': [E, ['Olives', 'Câpres', 'Anchois', 'Huile d\'olive', 'Pain']],
  'tarama': [E, ['Tarama (œufs de cabillaud)', 'Pain']],

  // Plats (dont spécialités du Nord)
  'welsh': [P, ['Pain de campagne', 'Cheddar', 'Bière', 'Moutarde', 'Jambon', 'Œuf', 'Frites']],
  'carbonnade': [P, ['Joues de bœuf', 'Bière', 'Pain d\'épices', 'Moutarde', 'Cassonade', 'Oignons', 'Frites']],
  'potjevleesch': [P, ['Poulet, lapin, porc, veau', 'Gelée au vinaigre', 'Frites', 'Mayonnaise']],
  'moules': [P, ['Moules', 'Vin blanc', 'Échalotes', 'Céleri', 'Beurre', 'Persil', 'Frites']],
  'waterzooi': [P, ['Poulet', 'Poireaux', 'Carottes', 'Céleri', 'Crème', 'Jaune d\'œuf']],
  'coq a la biere': [P, ['Poulet', 'Bière', 'Champignons', 'Crème', 'Lardons']],
  'tarte au maroilles': [P, ['Pâte brisée', 'Maroilles', 'Crème', 'Œufs']],
  'flamiche': [P, ['Pâte brisée', 'Maroilles', 'Poireaux', 'Crème', 'Œufs']],
  'andouillette': [P, ['Andouillette', 'Sauce moutarde (moutarde, crème)', 'Frites']],
  'steak tartare': [P, ['Bœuf haché', 'Jaune d\'œuf', 'Câpres', 'Cornichons', 'Moutarde', 'Sauce Worcestershire', 'Échalotes', 'Frites']],
  'tartare': [P, ['Bœuf haché', 'Jaune d\'œuf', 'Câpres', 'Cornichons', 'Moutarde', 'Sauce Worcestershire', 'Échalotes', 'Frites']],
  'entrecote': [P, ['Entrecôte', 'Frites', 'Sauce béarnaise (beurre, œufs, vinaigre)']],
  'bavette': [P, ['Bavette', 'Échalotes', 'Frites']],
  'steak frites': [P, ['Steak', 'Frites']],
  'burger': [P, ['Pain burger aux graines de sésame', 'Steak haché', 'Cheddar', 'Salade', 'Tomate', 'Oignons', 'Sauce burger (mayonnaise, ketchup, cornichons)', 'Frites']],
  'croque monsieur': [P, ['Pain de mie', 'Jambon', 'Emmental', 'Béchamel (lait, farine, beurre)']],
  'croque madame': [P, ['Pain de mie', 'Jambon', 'Emmental', 'Béchamel (lait, farine, beurre)', 'Œuf']],
  'croque': [P, ['Pain de mie', 'Jambon', 'Emmental', 'Béchamel (lait, farine, beurre)']],
  'bourguignon': [P, ['Bœuf', 'Vin rouge', 'Lardons', 'Champignons', 'Carottes', 'Oignons', 'Farine de blé']],
  'blanquette': [P, ['Veau', 'Carottes', 'Champignons', 'Crème', 'Beurre', 'Farine de blé', 'Jaune d\'œuf', 'Fond de veau (céleri)']],
  'pot au feu': [P, ['Bœuf', 'Carottes', 'Poireaux', 'Navets', 'Céleri', 'Moutarde']],
  'confit de canard': [P, ['Cuisse de canard confite', 'Pommes de terre sarladaises']],
  'magret': [P, ['Magret de canard', 'Miel', 'Pommes de terre']],
  'poulet roti': [P, ['Poulet', 'Beurre', 'Pommes de terre']],
  'supreme de volaille': [P, ['Volaille', 'Crème', 'Champignons', 'Vin blanc']],
  'choucroute': [P, ['Choucroute', 'Saucisses', 'Lard', 'Vin blanc', 'Moutarde', 'Pommes de terre']],
  'cassoulet': [P, ['Haricots blancs', 'Saucisse', 'Confit de canard', 'Tomate', 'Chapelure']],
  'hachis parmentier': [P, ['Bœuf haché', 'Pommes de terre', 'Lait', 'Beurre', 'Emmental']],
  'parmentier': [P, ['Pommes de terre', 'Lait', 'Beurre', 'Emmental']],
  'lasagne': [P, ['Pâtes à lasagne', 'Bœuf', 'Sauce tomate', 'Céleri', 'Béchamel (lait, farine, beurre)', 'Parmesan']],
  'bolognaise': [P, ['Spaghetti', 'Bœuf', 'Sauce tomate', 'Carottes', 'Céleri', 'Vin rouge', 'Parmesan']],
  'carbonara': [P, ['Spaghetti', 'Guanciale', 'Jaune d\'œuf', 'Parmesan', 'Poivre']],
  'pates': [P, ['Pâtes', 'Parmesan']],
  'gnocchi': [P, ['Gnocchi', 'Parmesan', 'Beurre']],
  'risotto': [P, ['Riz arborio', 'Parmesan', 'Beurre', 'Vin blanc', 'Bouillon de légumes (céleri)']],
  'pizza': [P, ['Pâte à pizza', 'Sauce tomate', 'Mozzarella']],
  'margherita': [P, ['Pâte à pizza', 'Sauce tomate', 'Mozzarella', 'Basilic']],
  'quiche': [P, ['Pâte brisée', 'Lardons', 'Œufs', 'Crème', 'Lait']],
  'fish and chips': [P, ['Cabillaud', 'Pâte à beignet (farine, bière)', 'Frites', 'Sauce tartare (mayonnaise, câpres)']],
  'cabillaud': [P, ['Cabillaud', 'Beurre blanc (beurre, vin blanc, échalote)']],
  'saumon': [P, ['Saumon', 'Beurre', 'Citron']],
  'sole meuniere': [P, ['Sole', 'Farine de blé', 'Beurre', 'Citron']],
  'saint jacques': [P, ['Noix de Saint-Jacques', 'Beurre', 'Crème']],
  'poke': [P, ['Riz', 'Saumon', 'Avocat', 'Edamame', 'Sauce soja', 'Graines de sésame', 'Mangue']],
  'couscous': [P, ['Semoule de blé', 'Légumes', 'Pois chiches', 'Merguez', 'Poulet', 'Bouillon (céleri)']],
  'tajine': [P, ['Agneau', 'Pruneaux', 'Amandes', 'Oignons', 'Épices']],
  'paella': [P, ['Riz', 'Crevettes', 'Moules', 'Calamars', 'Poulet', 'Chorizo', 'Poivron']],
  'bouillabaisse': [P, ['Poissons de roche', 'Rouille (œuf, ail, huile)', 'Croûtons', 'Fumet de poisson']],
  'vol au vent': [P, ['Pâte feuilletée', 'Poulet', 'Champignons', 'Crème', 'Beurre', 'Farine de blé']],
  'bouchee a la reine': [P, ['Pâte feuilletée', 'Poulet', 'Champignons', 'Crème', 'Beurre', 'Farine de blé']],
  'tartiflette': [P, ['Pommes de terre', 'Reblochon', 'Lardons', 'Oignons', 'Crème', 'Vin blanc']],
  'raclette': [P, ['Fromage à raclette', 'Pommes de terre', 'Charcuterie', 'Cornichons']],
  'curry': [P, ['Poulet', 'Lait de coco', 'Pâte de curry', 'Riz']],
  'pad thai': [P, ['Nouilles de riz', 'Crevettes', 'Œuf', 'Cacahuètes', 'Sauce poisson', 'Germes de soja']],
  'sushi': [P, ['Riz', 'Saumon', 'Vinaigre de riz', 'Sauce soja', 'Graines de sésame', 'Wasabi']],
  'maki': [P, ['Riz', 'Saumon', 'Algue nori', 'Vinaigre de riz', 'Sauce soja', 'Graines de sésame']],
  'tacos': [P, ['Tortilla de blé', 'Viande', 'Frites', 'Sauce fromagère (lait, crème)']],
  'kebab': [P, ['Pain pita', 'Viande', 'Salade', 'Tomate', 'Oignon', 'Sauce blanche (yaourt, mayonnaise)']],
  'omelette': [P, ['Œufs', 'Beurre', 'Lait']],
  'gratin dauphinois': [P, ['Pommes de terre', 'Crème', 'Lait', 'Ail', 'Beurre']],
  'puree': [P, ['Pommes de terre', 'Lait', 'Beurre']],
  'frites': [P, ['Frites']],

  // Desserts
  'tarte au sucre': [D, ['Pâte levée (farine, œufs, beurre, lait)', 'Cassonade', 'Crème']],
  'merveilleux': [D, ['Meringue', 'Crème chantilly', 'Copeaux de chocolat']],
  'gaufre': [D, ['Farine de blé', 'Œufs', 'Lait', 'Beurre', 'Sucre']],
  'crepe': [D, ['Farine de blé', 'Œufs', 'Lait', 'Beurre', 'Sucre']],
  'creme brulee': [D, ['Crème', 'Jaunes d\'œufs', 'Sucre', 'Vanille']],
  'mousse au chocolat': [D, ['Chocolat noir', 'Œufs', 'Sucre']],
  'fondant au chocolat': [D, ['Chocolat noir', 'Beurre', 'Œufs', 'Farine de blé', 'Sucre']],
  'moelleux au chocolat': [D, ['Chocolat noir', 'Beurre', 'Œufs', 'Farine de blé', 'Sucre']],
  'tiramisu': [D, ['Mascarpone', 'Œufs', 'Biscuits cuillère (farine, œufs)', 'Café', 'Cacao', 'Marsala']],
  'ile flottante': [D, ['Œufs', 'Lait', 'Sucre', 'Caramel']],
  'iles flottantes': [D, ['Œufs', 'Lait', 'Sucre', 'Caramel']],
  'profiteroles': [D, ['Pâte à choux (farine, œufs, beurre, lait)', 'Glace vanille', 'Sauce chocolat', 'Amandes effilées']],
  'tarte tatin': [D, ['Pommes', 'Pâte brisée', 'Beurre', 'Sucre', 'Crème fraîche']],
  'tarte aux pommes': [D, ['Pâte brisée', 'Pommes', 'Sucre', 'Beurre']],
  'tarte au citron': [D, ['Pâte sablée', 'Citron', 'Œufs', 'Beurre', 'Sucre', 'Meringue']],
  'cheesecake': [D, ['Fromage frais', 'Biscuits', 'Beurre', 'Œufs', 'Crème', 'Sucre']],
  'panna cotta': [D, ['Crème', 'Sucre', 'Gélatine', 'Coulis de fruits rouges']],
  'creme caramel': [D, ['Lait', 'Œufs', 'Sucre', 'Caramel']],
  'flan': [D, ['Lait', 'Œufs', 'Sucre', 'Pâte brisée']],
  'riz au lait': [D, ['Riz', 'Lait', 'Sucre', 'Vanille']],
  'salade de fruits': [D, ['Fruits frais']],
  'sorbet': [D, ['Sorbet']],
  'glace': [D, ['Crème glacée (lait, œufs)']],
  'dame blanche': [D, ['Crème glacée (lait, œufs)', 'Sauce chocolat', 'Chantilly']],
  'cafe liegeois': [D, ['Café', 'Crème glacée (lait, œufs)', 'Chantilly']],
  'chocolat liegeois': [D, ['Chocolat', 'Crème glacée (lait, œufs)', 'Chantilly']],
  'baba au rhum': [D, ['Baba (farine, œufs, beurre)', 'Rhum', 'Chantilly']],
  'paris brest': [D, ['Pâte à choux (farine, œufs, beurre, lait)', 'Crème au praliné', 'Amandes effilées']],
  'macaron': [D, ['Poudre d\'amande', 'Blancs d\'œufs', 'Sucre']],
  'financier': [D, ['Poudre d\'amande', 'Beurre', 'Blancs d\'œufs', 'Farine de blé']],
  'crumble': [D, ['Farine de blé', 'Beurre', 'Sucre', 'Fruits']],
  'brownie': [D, ['Chocolat noir', 'Beurre', 'Œufs', 'Farine de blé', 'Noix']],
  'cookie': [D, ['Farine de blé', 'Beurre', 'Œufs', 'Chocolat', 'Sucre']],
  'fromage blanc': [D, ['Fromage blanc', 'Coulis de fruits rouges']],
  'cafe gourmand': [D, ['Café', 'Mignardises (farine, œufs, beurre, lait)']],
};

const KEYS = Object.keys(DISH_PRESETS).sort((a, b) => b.length - a.length);

function norm(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-'’]/g, (c) => (c === '-' ? ' ' : "'"))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Recette type correspondant à un nom de plat, ou null. */
export function findPreset(dishName) {
  const name = ` ${norm(dishName)} `;
  for (const key of KEYS) {
    if (name.includes(` ${norm(key)}`)) {
      const [category, ingredients] = DISH_PRESETS[key];
      return { key, category, ingredients: [...ingredients] };
    }
  }
  return null;
}
