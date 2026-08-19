/**
 * Every id below has been looked at, not merely fetched.
 *
 * An earlier version of this file claimed the ids were "verified", meaning only
 * that they returned 200. They did — Unsplash serves *a* photo for almost any
 * well-formed id — but roughly thirty of them served the wrong subject, and two
 * served footwear. A dish photo that loads is not a dish photo that is right.
 *
 * So the check is now visual: every id was downloaded, laid out in a contact
 * sheet against its dish name, and inspected. Replacing one means doing that
 * again — `alt` text is machine-generated and regularly disagrees with the
 * picture, so it cannot stand in for looking.
 *
 * All requests go through Unsplash's transform pipeline with a fixed crop,
 * which keeps card aspect ratios uniform and payloads small.
 */
export const img = (id: string, w = 1200, h?: number): string => {
  const crop = h ? `&h=${h}` : '';
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}${crop}&q=80`;
};

export const IMG = {
  // ── espresso bar ──────────────────────────────────────────────────────────
  espresso: 'photo-1510707577719-ae7c14805e3a',
  espressoDouble: 'photo-1596952954288-16862d37405b',
  americano: 'photo-1551030173-122aabc4489c',
  cappuccino: 'photo-1572442388796-11668a67e53d',
  latte: 'photo-1509042239860-f550ce710b93',
  flatWhite: 'photo-1503481766315-7a586b20f66d',
  cortado: 'photo-1599648918269-be678fd72631',
  mocha: 'photo-1648145800880-0dcec0f85848',
  macchiato: 'photo-1585494156145-1c60a4fe952b',
  spanishLatte: 'photo-1550247611-e651810312fe',
  caramelLatte: 'photo-1579888071069-c107a6f79d82',
  vanillaLatte: 'photo-1517256064527-09c73fc73e38',
  hazelnutLatte: 'photo-1534778101976-62847782c213',
  filterCoffee: 'photo-1495474472287-4d71bcdd2085',

  // ── cold ──────────────────────────────────────────────────────────────────
  icedAmericano: 'photo-1578314675249-a6910f80cc4e',
  icedLatte: 'photo-1461023058943-07fcbe16d735',
  icedMocha: 'photo-1586195831800-24f14c992cea',
  coldBrew: 'photo-1517701550927-30cf4ba1dba5',
  vanillaColdBrew: 'photo-1561641377-f7456d23aa9b',
  coffeeTonic: 'photo-1629022194335-b2eca031e320',
  espressoTonic: 'photo-1594492634282-12a04144fbfa',
  affogato: 'photo-1599900134790-6d22e389173a',

  // ── matcha & tea ──────────────────────────────────────────────────────────
  matchaLatte: 'photo-1536256263959-770b48d82b0a',
  icedMatcha: 'photo-1748466990753-dc200e7e0ace',
  ceremonialMatcha: 'photo-1624893464636-c122891445c6',
  masalaChai: 'photo-1683533699004-7f6b9e5a073f',
  earlGrey: 'photo-1544787219-7f47ccb76574',
  chamomile: 'photo-1602603412313-ab713536e288',
  greenTea: 'photo-1571934811356-5cc061b6821f',
  mintTea: 'photo-1567708415681-d1d249e182eb',

  // ── breakfast ─────────────────────────────────────────────────────────────
  avocadoToast: 'photo-1588137378633-dea1336ce1e2',
  eggsBenedict: 'photo-1608039829572-78524f79c4c7',
  scrambledEggs: 'photo-1733105666420-729679827ba1',
  frenchToast: 'photo-1484723091739-30a097e8f929',
  granola: 'photo-1488477181946-6428a0291777',
  acaiBowl: 'photo-1622390001194-1af7f50c873a',
  breakfastCroissant: 'photo-1549903072-7e6e0bedb7fb',
  pancakes: 'photo-1567620905732-2d1ec7ab7445',
  breakfastSpread: 'photo-1482049016688-2d3e1b311543',
  yogurtBowl: 'photo-1511690743698-d9d85f2fbf38',

  // ── bakery ────────────────────────────────────────────────────────────────
  butterCroissant: 'photo-1555507036-ab1f4038808a',
  cinnamonRoll: 'photo-1509365465985-25d11c17e812',
  muffin: 'photo-1607958996333-41aef7caefaa',
  bananaBread: 'photo-1606101273945-e9eba91c0dc4',
  cookie: 'photo-1499636136210-6f4ee915583e',
  almondCroissant: 'photo-1710220988376-16dbd51fd1de',
  painAuChocolat: 'photo-1483695028939-5bb13f8648b0',

  // ── sandwiches ────────────────────────────────────────────────────────────
  pestoPanini: 'photo-1553909489-cd47e0907980',
  sandwich: 'photo-1528735602780-2552fd46c7af',
  grilledCheese: 'photo-1528736235302-52922df5c122',
  burrataSandwich: 'photo-1639667852145-466e29aa49fd',
  mushroomMelt: 'photo-1617869725629-7291855efb89',

  // ── pasta ─────────────────────────────────────────────────────────────────
  trufflePasta: 'photo-1595295333158-4742f28fbd85',
  pestoPasta: 'photo-1567608285969-48e4bbe0d399',
  arrabbiata: 'photo-1608756687911-aa1599ab3bd9',
  alfredo: 'photo-1645112411341-6c4fd023714a',
  pasta: 'photo-1551183053-bf91a1d81141',
  pastaAlt: 'photo-1473093295043-cdd812d0e601',

  // ── salads ────────────────────────────────────────────────────────────────
  caesarSalad: 'photo-1550304943-4f24f54ddde9',
  quinoaSalad: 'photo-1512621776951-a57141f2eefd',
  mediterraneanSalad: 'photo-1529059997568-3d847b1154f0',
  gardenSalad: 'photo-1540420773420-3366772f4999',
  saladBowl: 'photo-1505253716362-afaea1d3d1af',

  // ── desserts ──────────────────────────────────────────────────────────────
  tiramisu: 'photo-1571877227200-a0d98ea607e9',
  basqueCheesecake: 'photo-1638519651608-412009302a02',
  berryCheesecake: 'photo-1524351199678-941a58a3df50',
  chocolateTart: 'photo-1616031037011-087000171abe',
  brownie: 'photo-1607920591413-4ec007e70023',
  pannaCotta: 'photo-1452968011964-24f8831c43c3',
  lemonTart: 'photo-1541781550486-81b7a2328578',
  affogatoSundae: 'photo-1579954115563-e72bf1381629',
  chocolate: 'photo-1562440499-64c9a111f713',

  // ── signature specials ────────────────────────────────────────────────────
  // These began life sharing a photo with the drink they riff on, which made
  // the menu look duplicated. Each now has its own.
  roseCardamomLatte: 'photo-1761102912980-37d29d9bea4b',
  pistachioLatte: 'photo-1729869257061-dec08b3747bd',
  kesarBadamCortado: 'photo-1684084373817-e51c7f7ab041',
  malabarColdBrew: 'photo-1484542959923-de288ec85ce1',
  jaggeryLatte: 'photo-1601390501377-34e129291cdb',
  matchaCloud: 'photo-1515823064-d6e0c04616a7',
  truffleMushroomToast: 'photo-1561310727-48dab7f00e09',
  bombayGrilledCheese: 'photo-1716535233357-822bcc293573',
  chettinadPanini: 'photo-1475090169767-40ed8d18f67d',
  avocadoFetaToast: 'photo-1641283339694-f7bc5b3673ca',

  // ── brand & editorial ─────────────────────────────────────────────────────
  heroPour: 'photo-1442512595331-e89e73853f31',
  heroInterior: 'photo-1554118811-1e0d58224f24',
  interiorWarm: 'photo-1521017432531-fbd92d768814',
  interiorSeats: 'photo-1559925393-8be0ec4767c8',
  barista: 'photo-1513558161293-cdaf765ed2fd',
  roasting: 'photo-1559525839-b184a4d698c7',
  beans: 'photo-1524350876685-274059332603',
  beansClose: 'photo-1541167760496-1628856ab772',
  exterior: 'photo-1600093463592-8e36ae95ef56',
  cafeStreet: 'photo-1493857671505-72967e2e2760',
  tableTop: 'photo-1501339847302-ac426a4a7cbb',
  communal: 'photo-1453614512568-c4024d13c247',
  window: 'photo-1414235077428-338989a2e8c0',
  kitchen: 'photo-1432139555190-58524dae6a55',
} as const;
