const REGISTRY_GROUPS = {
  Breast: {
    golden: ['TAILORx', 'RxPONDER', 'KATHERINE', 'KEYNOTE-522', 'OlympiA', 'monarchE', 'CLEOPATRA', 'DESTINY-Breast03', 'DESTINY-Breast04', 'DESTINY-Breast06', 'INAVO120', 'PATINA', 'ASCENT'],
    related: ['MINDACT', 'DESTINY-Breast05', 'TROPiCS-02', 'EMBRACA'],
  },
  GI: {
    golden: ['PRODIGE 24', 'CheckMate 649', 'KEYNOTE-811', 'MATTERHORN', 'DESTINY-Gastric04', 'KEYNOTE-590', 'CheckMate 648', 'CROSS', 'TOPAZ-1', 'KEYNOTE-177', 'BEACON CRC', 'BREAKWATER', 'PRODIGE 23', 'IMbrave150', 'CheckMate 9DW'],
    related: ['ESPAC-4', 'APACT', 'PREOPANC', 'KEYNOTE-966', 'PROSPECT', 'RAPIDO', 'OPRA', 'IDEA', 'HIMALAYA'],
  },
  GU: {
    golden: ['JAVELIN Bladder 100', 'EV-302/KEYNOTE-A39', 'CheckMate 901', 'EV-301', 'THOR', 'CheckMate 274', 'KEYNOTE-564', 'CheckMate 214', 'CheckMate 9ER', 'PROfound', 'VISION', 'ARASENS', 'PEACE-1', 'TALAPRO-2'],
    related: ['KEYNOTE-052', 'KEYNOTE-045', 'AMBASSADOR', 'COSMIC-313', 'PROpel', 'MAGNITUDE'],
  },
  GYN: {
    golden: ['SOLO-1', 'MIRASOL', 'NRG-GY018', 'RUBY', 'KEYNOTE-775', 'KEYNOTE-826', 'INTERLACE'],
    related: ['PAOLA-1', 'PRIMA', 'DUO-E'],
  },
  'Head & Neck': {
    golden: ['KEYNOTE-048', 'KEYNOTE-689', 'RTOG 1016', 'JUPITER-02'],
    related: ['EXTREME', 'CAPTAIN-1st', 'NPC induction GP versus PF'],
  },
  Heme: {
    golden: ['VIALE-A', 'QUAZAR AML-001', 'RATIFY', 'ADMIRAL', 'ECHELON-1', 'POLARIX', 'ZUMA-7', 'GALLIUM', 'MAIA', 'PERSEUS'],
    related: ['TRIANGLE', 'TRANSFORM', 'DETERMINATION'],
  },
  Lung: {
    golden: ['CheckMate 816', 'KEYNOTE-671', 'AEGEAN', 'ADAURA', 'IMpower010', 'KEYNOTE-091', 'PACIFIC', 'LAURA', 'KEYNOTE-024', 'KEYNOTE-189', 'KEYNOTE-407', 'FLAURA2', 'CROWN', 'IMpower133', 'CASPIAN', 'ADRIATIC', 'CheckMate 743'],
    related: ['IMpower150', 'CheckMate 9LA', 'DeLLphi-301', 'CONVERT', 'CALGB 30610/RTOG 0538', 'KEYNOTE-604', 'MAPS'],
  },
  Other: {
    golden: ['CheckMate 067', 'Stupp', 'NETTER-1'],
    related: ['DREAMseq', 'RELATIVITY-047', 'CheckMate 548', 'SARC028'],
  },
};

const ALIASES = {
  'EV-302/KEYNOTE-A39': ['EV-302', 'KEYNOTE-A39'],
  'CALGB 30610/RTOG 0538': ['CALGB 30610', 'RTOG 0538'],
  'JAVELIN Bladder 100': ['JAVELIN-Bladder-100'],
  'PRODIGE 23': ['PRODIGE-23'],
  'PRODIGE 24': ['PRODIGE-24'],
};

// Pending trials receive a suggested destination for review; this is not a live assignment.
const PROPOSED_DAY_IDS = {
  'DESTINY-Breast06': [22], INAVO120: [20], PATINA: [21], 'DESTINY-Breast05': [17], 'TROPiCS-02': [20], EMBRACA: [19],
  'KEYNOTE-811': [31], MATTERHORN: [31], 'DESTINY-Gastric04': [31], 'KEYNOTE-590': [32], 'CheckMate 648': [32], 'KEYNOTE-177': [27], 'BEACON CRC': [27], BREAKWATER: [27], 'CheckMate 9DW': [33],
  'ESPAC-4': [34], APACT: [34], PREOPANC: [34], PROSPECT: [29],
  'EV-302/KEYNOTE-A39': [41], 'CheckMate 901': [41], 'EV-301': [41], 'CheckMate 214': [39], PROfound: [43], 'KEYNOTE-052': [41], 'KEYNOTE-045': [41], AMBASSADOR: [40], 'COSMIC-313': [39], MAGNITUDE: [43],
  'NRG-GY018': [48], INTERLACE: [49], 'DUO-E': [48],
  'KEYNOTE-689': [57], EXTREME: [58], 'CAPTAIN-1st': [59], 'NPC induction GP versus PF': [59],
  GALLIUM: [63], MAIA: [64], TRIANGLE: [63], DETERMINATION: [64],
  AEGEAN: [4], IMpower010: [2], 'KEYNOTE-091': [2], LAURA: [3], 'KEYNOTE-407': [8], FLAURA2: [6], ADRIATIC: [9], IMpower150: [8], 'CheckMate 9LA': [8], 'DeLLphi-301': [10], 'KEYNOTE-604': [10], MAPS: [11],
  'CheckMate 067': [66], DREAMseq: [66], 'RELATIVITY-047': [66], SARC028: [67],
};

const ADDITIONAL_REVIEWED_TRIALS = [
  {
    "name": "PROFILE",
    "canonicalName": "PROFILE",
    "cancer": "Lung",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      6
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "LIBRETTO",
    "canonicalName": "LIBRETTO",
    "cancer": "Lung",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      6
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "CodeBreaK",
    "canonicalName": "CodeBreaK",
    "cancer": "Lung",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      7
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "DESTINY-Lung",
    "canonicalName": "DESTINY-Lung",
    "cancer": "Lung",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      7
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "CheckMate-227",
    "canonicalName": "CheckMate-227",
    "cancer": "Lung",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      8
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "NATALEE",
    "canonicalName": "NATALEE",
    "cancer": "Breast",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      16
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "APHINITY",
    "canonicalName": "APHINITY",
    "cancer": "Breast",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      17
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "PALOMA",
    "canonicalName": "PALOMA",
    "cancer": "Breast",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      20
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "MONALEESA",
    "canonicalName": "MONALEESA",
    "cancer": "Breast",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      20
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "SOLAR-1",
    "canonicalName": "SOLAR-1",
    "cancer": "Breast",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      20
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "HER2CLIMB",
    "canonicalName": "HER2CLIMB",
    "cancer": "Breast",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      21
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "KEYNOTE-355",
    "canonicalName": "KEYNOTE-355",
    "cancer": "Breast",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      23
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "FIRE-3",
    "canonicalName": "FIRE-3",
    "cancer": "GI",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      27
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "PARADIGM",
    "canonicalName": "PARADIGM",
    "cancer": "GI",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      27
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "VELOUR",
    "canonicalName": "VELOUR",
    "cancer": "GI",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      28
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "RAISE",
    "canonicalName": "RAISE",
    "cancer": "GI",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      28
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "SUNLIGHT",
    "canonicalName": "SUNLIGHT",
    "cancer": "GI",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      28
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "KEYNOTE-859",
    "canonicalName": "KEYNOTE-859",
    "cancer": "GI",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      31
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "SPOTLIGHT",
    "canonicalName": "SPOTLIGHT",
    "cancer": "GI",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      31
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "CheckMate-577",
    "canonicalName": "CheckMate-577",
    "cancer": "GI",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      32
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "POLO",
    "canonicalName": "POLO",
    "cancer": "GI",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      34
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "CLEAR",
    "canonicalName": "CLEAR",
    "cancer": "GU",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      39
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "KEYNOTE-A18",
    "canonicalName": "KEYNOTE-A18",
    "cancer": "GYN",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      49
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "DeCIDE",
    "canonicalName": "DeCIDE",
    "cancer": "Head & Neck",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      57
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "CheckMate-141",
    "canonicalName": "CheckMate-141",
    "cancer": "Head & Neck",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      58
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "RATHL",
    "canonicalName": "RATHL",
    "cancer": "Heme",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      61
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "GRIFFIN",
    "canonicalName": "GRIFFIN",
    "cancer": "Heme",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      64
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "CARTITUDE",
    "canonicalName": "CARTITUDE",
    "cancer": "Heme",
    "classification": "related",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      65
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "KarMMa",
    "canonicalName": "KarMMa",
    "cancer": "Heme",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      65
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "COMBI-AD",
    "canonicalName": "COMBI-AD",
    "cancer": "Other",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      66
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "CheckMate-238",
    "canonicalName": "CheckMate-238",
    "cancer": "Other",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      66
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "KEYNOTE-629",
    "canonicalName": "KEYNOTE-629",
    "cancer": "Other",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      66
    ],
    "reviewStatus": "pending"
  },
  {
    "name": "PALETTE",
    "canonicalName": "PALETTE",
    "cancer": "Other",
    "classification": "golden",
    "aliases": [],
    "assignedDayIds": [],
    "proposedDayIds": [
      67
    ],
    "reviewStatus": "pending"
  }
];

const EXCLUDED_PLAN_ITEM_NAMES = new Set(['NCCN Algorithm']);

// Human-reviewed decisions imported from docs/trial-registry-review.md.
export const TRIAL_REVIEW_DECISIONS = {
  "MINDACT": {
    "classification": "related",
    "assignedDayIds": [
      15
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-966": {
    "classification": "golden",
    "assignedDayIds": [
      35
    ],
    "reviewStatus": "approved"
  },
  "RAPIDO": {
    "classification": "related",
    "assignedDayIds": [
      29
    ],
    "reviewStatus": "approved"
  },
  "OPRA": {
    "classification": "related",
    "assignedDayIds": [
      29
    ],
    "reviewStatus": "approved"
  },
  "IDEA": {
    "classification": "golden",
    "assignedDayIds": [
      30
    ],
    "reviewStatus": "approved"
  },
  "HIMALAYA": {
    "classification": "golden",
    "assignedDayIds": [
      33
    ],
    "reviewStatus": "approved"
  },
  "PROpel": {
    "classification": "related",
    "assignedDayIds": [
      43
    ],
    "reviewStatus": "approved"
  },
  "PAOLA-1": {
    "classification": "golden",
    "assignedDayIds": [
      50
    ],
    "reviewStatus": "approved"
  },
  "PRIMA": {
    "classification": "related",
    "assignedDayIds": [
      50
    ],
    "reviewStatus": "approved"
  },
  "TRANSFORM": {
    "classification": "golden",
    "assignedDayIds": [
      62
    ],
    "reviewStatus": "approved"
  },
  "CONVERT": {
    "classification": "golden",
    "assignedDayIds": [
      9
    ],
    "reviewStatus": "approved"
  },
  "CALGB 30610/RTOG 0538": {
    "classification": "related",
    "assignedDayIds": [
      9
    ],
    "reviewStatus": "approved"
  },
  "DESTINY-Breast06": {
    "classification": "golden",
    "assignedDayIds": [
      22
    ],
    "reviewStatus": "approved"
  },
  "INAVO120": {
    "classification": "golden",
    "assignedDayIds": [
      20
    ],
    "reviewStatus": "approved"
  },
  "PATINA": {
    "classification": "golden",
    "assignedDayIds": [
      21
    ],
    "reviewStatus": "approved"
  },
  "DESTINY-Breast05": {
    "classification": "golden",
    "assignedDayIds": [
      17
    ],
    "reviewStatus": "approved"
  },
  "TROPiCS-02": {
    "classification": "related",
    "assignedDayIds": [
      20
    ],
    "reviewStatus": "approved"
  },
  "EMBRACA": {
    "classification": "related",
    "assignedDayIds": [
      19
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-811": {
    "classification": "golden",
    "assignedDayIds": [
      31
    ],
    "reviewStatus": "approved"
  },
  "MATTERHORN": {
    "classification": "golden",
    "assignedDayIds": [
      31
    ],
    "reviewStatus": "approved"
  },
  "DESTINY-Gastric04": {
    "classification": "golden",
    "assignedDayIds": [
      31
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-590": {
    "classification": "golden",
    "assignedDayIds": [
      32
    ],
    "reviewStatus": "approved"
  },
  "CheckMate 648": {
    "classification": "golden",
    "assignedDayIds": [
      32
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-177": {
    "classification": "golden",
    "assignedDayIds": [
      27
    ],
    "reviewStatus": "approved"
  },
  "BEACON CRC": {
    "classification": "golden",
    "assignedDayIds": [
      27
    ],
    "reviewStatus": "approved"
  },
  "BREAKWATER": {
    "classification": "golden",
    "assignedDayIds": [
      27
    ],
    "reviewStatus": "approved"
  },
  "CheckMate 9DW": {
    "classification": "golden",
    "assignedDayIds": [
      33
    ],
    "reviewStatus": "approved"
  },
  "ESPAC-4": {
    "classification": "golden",
    "assignedDayIds": [
      34
    ],
    "reviewStatus": "approved"
  },
  "APACT": {
    "classification": "related",
    "assignedDayIds": [
      34
    ],
    "reviewStatus": "approved"
  },
  "PREOPANC": {
    "classification": "related",
    "assignedDayIds": [
      34
    ],
    "reviewStatus": "approved"
  },
  "PROSPECT": {
    "classification": "related",
    "assignedDayIds": [
      29
    ],
    "reviewStatus": "approved"
  },
  "CheckMate 901": {
    "classification": "golden",
    "assignedDayIds": [
      41
    ],
    "reviewStatus": "approved"
  },
  "EV-301": {
    "classification": "golden",
    "assignedDayIds": [
      41
    ],
    "reviewStatus": "approved"
  },
  "CheckMate 214": {
    "classification": "golden",
    "assignedDayIds": [
      39
    ],
    "reviewStatus": "approved"
  },
  "PROfound": {
    "classification": "golden",
    "assignedDayIds": [
      43
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-052": {
    "classification": "related",
    "assignedDayIds": [
      41
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-045": {
    "classification": "related",
    "assignedDayIds": [
      41
    ],
    "reviewStatus": "approved"
  },
  "AMBASSADOR": {
    "classification": "related",
    "assignedDayIds": [
      40
    ],
    "reviewStatus": "approved"
  },
  "COSMIC-313": {
    "classification": "related",
    "assignedDayIds": [
      39
    ],
    "reviewStatus": "approved"
  },
  "MAGNITUDE": {
    "classification": "related",
    "assignedDayIds": [
      43
    ],
    "reviewStatus": "approved"
  },
  "NRG-GY018": {
    "classification": "golden",
    "assignedDayIds": [
      48
    ],
    "reviewStatus": "approved"
  },
  "INTERLACE": {
    "classification": "golden",
    "assignedDayIds": [
      49
    ],
    "reviewStatus": "approved"
  },
  "DUO-E": {
    "classification": "related",
    "assignedDayIds": [
      48
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-689": {
    "classification": "golden",
    "assignedDayIds": [
      57
    ],
    "reviewStatus": "approved"
  },
  "EXTREME": {
    "classification": "golden",
    "assignedDayIds": [
      58
    ],
    "reviewStatus": "approved"
  },
  "CAPTAIN-1st": {
    "classification": "related",
    "assignedDayIds": [
      59
    ],
    "reviewStatus": "approved"
  },
  "NPC induction GP versus PF": {
    "classification": "related",
    "assignedDayIds": [
      59
    ],
    "reviewStatus": "approved"
  },
  "VIALE-A": {
    "classification": "golden",
    "assignedDayIds": [],
    "reviewStatus": "approved"
  },
  "QUAZAR AML-001": {
    "classification": "golden",
    "assignedDayIds": [],
    "reviewStatus": "approved"
  },
  "RATIFY": {
    "classification": "golden",
    "assignedDayIds": [],
    "reviewStatus": "approved"
  },
  "ADMIRAL": {
    "classification": "golden",
    "assignedDayIds": [],
    "reviewStatus": "approved"
  },
  "GALLIUM": {
    "classification": "golden",
    "assignedDayIds": [
      63
    ],
    "reviewStatus": "approved"
  },
  "MAIA": {
    "classification": "golden",
    "assignedDayIds": [
      64
    ],
    "reviewStatus": "approved"
  },
  "TRIANGLE": {
    "classification": "related",
    "assignedDayIds": [
      63
    ],
    "reviewStatus": "approved"
  },
  "DETERMINATION": {
    "classification": "related",
    "assignedDayIds": [
      64
    ],
    "reviewStatus": "approved"
  },
  "AEGEAN": {
    "classification": "golden",
    "assignedDayIds": [
      4
    ],
    "reviewStatus": "approved"
  },
  "IMpower010": {
    "classification": "golden",
    "assignedDayIds": [
      2
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-091": {
    "classification": "golden",
    "assignedDayIds": [
      2
    ],
    "reviewStatus": "approved"
  },
  "LAURA": {
    "classification": "golden",
    "assignedDayIds": [
      3
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-407": {
    "classification": "golden",
    "assignedDayIds": [
      8
    ],
    "reviewStatus": "approved"
  },
  "FLAURA2": {
    "classification": "golden",
    "assignedDayIds": [
      6
    ],
    "reviewStatus": "approved"
  },
  "ADRIATIC": {
    "classification": "golden",
    "assignedDayIds": [
      9
    ],
    "reviewStatus": "approved"
  },
  "IMpower150": {
    "classification": "golden",
    "assignedDayIds": [
      8
    ],
    "reviewStatus": "approved"
  },
  "CheckMate 9LA": {
    "classification": "related",
    "assignedDayIds": [
      8
    ],
    "reviewStatus": "approved"
  },
  "DeLLphi-301": {
    "classification": "related",
    "assignedDayIds": [
      10
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-604": {
    "classification": "golden",
    "assignedDayIds": [
      10
    ],
    "reviewStatus": "approved"
  },
  "MAPS": {
    "classification": "related",
    "assignedDayIds": [
      11
    ],
    "reviewStatus": "approved"
  },
  "CheckMate 067": {
    "classification": "golden",
    "assignedDayIds": [
      66
    ],
    "reviewStatus": "approved"
  },
  "Stupp": {
    "classification": "related",
    "assignedDayIds": [],
    "reviewStatus": "approved"
  },
  "DREAMseq": {
    "classification": "related",
    "assignedDayIds": [
      66
    ],
    "reviewStatus": "approved"
  },
  "RELATIVITY-047": {
    "classification": "related",
    "assignedDayIds": [
      66
    ],
    "reviewStatus": "approved"
  },
  "CheckMate 548": {
    "classification": "related",
    "assignedDayIds": [],
    "reviewStatus": "approved"
  },
  "SARC028": {
    "classification": "related",
    "assignedDayIds": [
      67
    ],
    "reviewStatus": "approved"
  },
  "PROFILE": {
    "classification": "related",
    "assignedDayIds": [
      6
    ],
    "reviewStatus": "approved"
  },
  "LIBRETTO": {
    "classification": "golden",
    "assignedDayIds": [
      6
    ],
    "reviewStatus": "approved"
  },
  "CodeBreaK": {
    "classification": "golden",
    "assignedDayIds": [
      7
    ],
    "reviewStatus": "approved"
  },
  "DESTINY-Lung": {
    "classification": "golden",
    "assignedDayIds": [
      7
    ],
    "reviewStatus": "approved"
  },
  "CheckMate-227": {
    "classification": "golden",
    "assignedDayIds": [
      8
    ],
    "reviewStatus": "approved"
  },
  "NATALEE": {
    "classification": "golden",
    "assignedDayIds": [
      16
    ],
    "reviewStatus": "approved"
  },
  "APHINITY": {
    "classification": "golden",
    "assignedDayIds": [
      17
    ],
    "reviewStatus": "approved"
  },
  "PALOMA": {
    "classification": "related",
    "assignedDayIds": [
      20
    ],
    "reviewStatus": "approved"
  },
  "MONALEESA": {
    "classification": "golden",
    "assignedDayIds": [
      20
    ],
    "reviewStatus": "approved"
  },
  "SOLAR-1": {
    "classification": "golden",
    "assignedDayIds": [
      20
    ],
    "reviewStatus": "approved"
  },
  "HER2CLIMB": {
    "classification": "related",
    "assignedDayIds": [
      21
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-355": {
    "classification": "golden",
    "assignedDayIds": [
      23
    ],
    "reviewStatus": "approved"
  },
  "FIRE-3": {
    "classification": "golden",
    "assignedDayIds": [
      27
    ],
    "reviewStatus": "approved"
  },
  "PARADIGM": {
    "classification": "golden",
    "assignedDayIds": [
      27
    ],
    "reviewStatus": "approved"
  },
  "VELOUR": {
    "classification": "related",
    "assignedDayIds": [
      28
    ],
    "reviewStatus": "approved"
  },
  "RAISE": {
    "classification": "related",
    "assignedDayIds": [
      28
    ],
    "reviewStatus": "approved"
  },
  "SUNLIGHT": {
    "classification": "related",
    "assignedDayIds": [
      28
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-859": {
    "classification": "golden",
    "assignedDayIds": [
      31
    ],
    "reviewStatus": "approved"
  },
  "SPOTLIGHT": {
    "classification": "related",
    "assignedDayIds": [
      31
    ],
    "reviewStatus": "approved"
  },
  "CheckMate-577": {
    "classification": "golden",
    "assignedDayIds": [
      32
    ],
    "reviewStatus": "approved"
  },
  "POLO": {
    "classification": "golden",
    "assignedDayIds": [
      34
    ],
    "reviewStatus": "approved"
  },
  "CLEAR": {
    "classification": "related",
    "assignedDayIds": [
      39
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-A18": {
    "classification": "golden",
    "assignedDayIds": [
      49
    ],
    "reviewStatus": "approved"
  },
  "DeCIDE": {
    "classification": "golden",
    "assignedDayIds": [
      57
    ],
    "reviewStatus": "approved"
  },
  "CheckMate-141": {
    "classification": "golden",
    "assignedDayIds": [
      58
    ],
    "reviewStatus": "approved"
  },
  "RATHL": {
    "classification": "related",
    "assignedDayIds": [
      61
    ],
    "reviewStatus": "approved"
  },
  "GRIFFIN": {
    "classification": "related",
    "assignedDayIds": [
      64
    ],
    "reviewStatus": "approved"
  },
  "CARTITUDE": {
    "classification": "related",
    "assignedDayIds": [
      65
    ],
    "reviewStatus": "approved"
  },
  "KarMMa": {
    "classification": "golden",
    "assignedDayIds": [
      65
    ],
    "reviewStatus": "approved"
  },
  "COMBI-AD": {
    "classification": "golden",
    "assignedDayIds": [
      66
    ],
    "reviewStatus": "approved"
  },
  "CheckMate-238": {
    "classification": "golden",
    "assignedDayIds": [
      66
    ],
    "reviewStatus": "approved"
  },
  "KEYNOTE-629": {
    "classification": "golden",
    "assignedDayIds": [
      66
    ],
    "reviewStatus": "approved"
  },
  "PALETTE": {
    "classification": "golden",
    "assignedDayIds": [
      67
    ],
    "reviewStatus": "approved"
  }
};

export function normalizeTrialName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const trialRegistryCandidates = Object.entries(REGISTRY_GROUPS).flatMap(([cancer, groups]) => (
  Object.entries(groups).flatMap(([classification, names]) => names.map((name) => ({
    name,
    canonicalName: name,
    cancer,
    classification,
    aliases: ALIASES[name] || [],
    assignedDayIds: [],
    proposedDayIds: PROPOSED_DAY_IDS[name] || [],
    reviewStatus: 'pending',
  })))
)).concat(ADDITIONAL_REVIEWED_TRIALS);

function registryNameMatches(record, name) {
  const normalized = normalizeTrialName(name);
  return [record.canonicalName, ...record.aliases].some((candidate) => normalizeTrialName(candidate) === normalized);
}

export function reconcileTrialRegistryWithPlan(tasks) {
  const records = trialRegistryCandidates.map((candidate) => {
    const matchingTasks = tasks.filter((task) => (
      task.cancer === candidate.cancer
      && (task.goldenTrials || []).some((name) => registryNameMatches(candidate, name))
    ));
    const decision = TRIAL_REVIEW_DECISIONS[candidate.canonicalName];
    const approved = decision?.reviewStatus === 'approved'
      || (!decision && candidate.classification === 'golden' && matchingTasks.length > 0);
    const classification = decision?.classification || candidate.classification;
    const decidedDayIds = decision?.assignedDayIds || matchingTasks.map((task) => task.id);
    return {
      ...candidate,
      classification,
      assignedDayIds: approved ? decidedDayIds : [],
      proposedDayIds: matchingTasks.length > 0 ? matchingTasks.map((task) => task.id) : candidate.proposedDayIds,
      reviewStatus: approved ? 'approved' : 'pending',
      conflict: !decision && candidate.classification === 'related' && matchingTasks.length > 0,
    };
  });

  const approvedByDay = new Map();
  records.filter((record) => record.reviewStatus === 'approved').forEach((record) => {
    record.assignedDayIds.forEach((dayId) => {
      const bucket = approvedByDay.get(dayId) || { goldenTrials: [], relatedTrials: [] };
      bucket[record.classification === 'golden' ? 'goldenTrials' : 'relatedTrials'].push(record.canonicalName);
      approvedByDay.set(dayId, bucket);
    });
  });

  const unregisteredPlanItems = tasks.flatMap((task) => (task.goldenTrials || [])
    .filter((name) => !EXCLUDED_PLAN_ITEM_NAMES.has(name))
    .filter((name) => !records.some((record) => record.cancer === task.cancer && registryNameMatches(record, name)))
    .map((name) => ({ name, dayId: task.id, day: task.day, cancer: task.cancer, topic: task.topic })));

  return {
    records,
    unregisteredPlanItems,
    tasks: tasks.map((task) => ({
      ...task,
      goldenTrials: approvedByDay.get(task.id)?.goldenTrials || [],
      relatedTrials: approvedByDay.get(task.id)?.relatedTrials || [],
    })),
  };
}
