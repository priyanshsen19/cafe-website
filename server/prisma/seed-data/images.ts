/**
 * Every id below was verified to resolve before being committed, so the seeded
 * menu never renders a broken image. All requests go through Unsplash's
 * transform pipeline with a fixed crop, which keeps card aspect ratios uniform
 * and keeps payloads small.
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
  flatWhite: 'photo-1517959105821-eaf2591984ca',
  cortado: 'photo-1470337458703-46ad1756a187',
  mocha: 'photo-1578374173705-969cbe6f2d6b',
  macchiato: 'photo-1585494156145-1c60a4fe952b',
  spanishLatte: 'photo-1521302080334-4bebac2763a6',
  caramelLatte: 'photo-1552346154-21d32810aba3',
  vanillaLatte: 'photo-1517256064527-09c73fc73e38',
  hazelnutLatte: 'photo-1534778101976-62847782c213',
  filterCoffee: 'photo-1495474472287-4d71bcdd2085',

  // ── cold ──────────────────────────────────────────────────────────────────
  icedAmericano: 'photo-1578314675249-a6910f80cc4e',
  icedLatte: 'photo-1461023058943-07fcbe16d735',
  icedMocha: 'photo-1514432324607-a09d9b4aefdd',
  coldBrew: 'photo-1517701550927-30cf4ba1dba5',
  vanillaColdBrew: 'photo-1503481766315-7a586b20f66d',
  coffeeTonic: 'photo-1497636577773-f1231844b336',
  espressoTonic: 'photo-1447933601403-0c6688de566e',
  affogato: 'photo-1563805042-7684c019e1cb',

  // ── matcha & tea ──────────────────────────────────────────────────────────
  matchaLatte: 'photo-1536256263959-770b48d82b0a',
  icedMatcha: 'photo-1515823064-d6e0c04616a7',
  ceremonialMatcha: 'photo-1546069901-ba9599a7e63c',
  masalaChai: 'photo-1597481499750-3e6b22637e12',
  earlGrey: 'photo-1544787219-7f47ccb76574',
  chamomile: 'photo-1556679343-c7306c1976bc',
  greenTea: 'photo-1571934811356-5cc061b6821f',
  mintTea: 'photo-1576092768241-dec231879fc3',

  // ── breakfast ─────────────────────────────────────────────────────────────
  avocadoToast: 'photo-1588137378633-dea1336ce1e2',
  eggsBenedict: 'photo-1608039829572-78524f79c4c7',
  scrambledEggs: 'photo-1525351484163-7529414344d8',
  frenchToast: 'photo-1484723091739-30a097e8f929',
  granola: 'photo-1488477181946-6428a0291777',
  acaiBowl: 'photo-1590301157890-4810ed352733',
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
  pastryCase: 'photo-1550547660-d9450f859349',
  bread: 'photo-1481931098730-318b6f776db0',

  // ── sandwiches ────────────────────────────────────────────────────────────
  pestoPanini: 'photo-1553909489-cd47e0907980',
  sandwich: 'photo-1528735602780-2552fd46c7af',
  grilledCheese: 'photo-1528736235302-52922df5c122',
  burrataSandwich: 'photo-1608897013039-887f21d8c804',
  mushroomMelt: 'photo-1621996659490-3275b4d0d951',

  // ── pasta ─────────────────────────────────────────────────────────────────
  trufflePasta: 'photo-1595295333158-4742f28fbd85',
  pestoPasta: 'photo-1621996346565-e3dbc646d9a9',
  arrabbiata: 'photo-1608756687911-aa1599ab3bd9',
  alfredo: 'photo-1645112411341-6c4fd023714a',
  pasta: 'photo-1551183053-bf91a1d81141',
  pastaAlt: 'photo-1473093295043-cdd812d0e601',

  // ── salads ────────────────────────────────────────────────────────────────
  caesarSalad: 'photo-1546793665-c74683f339c1',
  quinoaSalad: 'photo-1512621776951-a57141f2eefd',
  mediterraneanSalad: 'photo-1529059997568-3d847b1154f0',
  gardenSalad: 'photo-1540420773420-3366772f4999',
  saladBowl: 'photo-1505253716362-afaea1d3d1af',

  // ── desserts ──────────────────────────────────────────────────────────────
  tiramisu: 'photo-1571877227200-a0d98ea607e9',
  basqueCheesecake: 'photo-1533134242443-d4fd215305ad',
  berryCheesecake: 'photo-1524351199678-941a58a3df50',
  chocolateTart: 'photo-1578985545062-69928b1d9587',
  brownie: 'photo-1607920591413-4ec007e70023',
  pannaCotta: 'photo-1488900128323-21503983a07e',
  lemonTart: 'photo-1519869325930-281384150729',
  dessertPlate: 'photo-1464195244916-405fa0a82545',
  chocolate: 'photo-1562440499-64c9a111f713',

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
