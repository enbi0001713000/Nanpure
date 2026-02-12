import type { Difficulty } from './types.js';

export type Puzzle = {
  id: string;
  puzzle: string;
  solution: string;
};

type PuzzleSeed = {
  puzzle: string;
  solution: string;
};

type Variant = {
  bandShift: number;
  rowShift: number;
  stackShift: number;
  colShift: number;
  digitShift: number;
  transpose: boolean;
};

export const RECENT_PUZZLE_QUEUE_SIZE = 6;

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'EASY',
  medium: 'NORMAL',
  hard: 'HARD',
  oni: 'ONI'
};

const variants: Variant[] = [
  { bandShift: 0, rowShift: 0, stackShift: 0, colShift: 0, digitShift: 0, transpose: false },
  { bandShift: 1, rowShift: 1, stackShift: 2, colShift: 2, digitShift: 2, transpose: false },
  { bandShift: 2, rowShift: 2, stackShift: 1, colShift: 1, digitShift: 4, transpose: true },
  { bandShift: 1, rowShift: 0, stackShift: 1, colShift: 2, digitShift: 6, transpose: true },
  { bandShift: 2, rowShift: 1, stackShift: 0, colShift: 1, digitShift: 8, transpose: false }
];

const seedBank: Record<Difficulty, PuzzleSeed[]> = {
  easy: [
    {
      puzzle: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
      solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
    },
    {
      puzzle: '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
      solution: '435269781682571493197834562826195347374682915951743628519326874248957136763418259'
    },
    {
      puzzle: '640080000700216000019000070900070004500904002800030007070000390000521006000090081',
      solution: '645789123783216459219453678961872534537964812824135967172648395398521746456397281'
    },
    {
      puzzle: '000370802790080010210005600930200050005703100060004039001400085050060047804029000',
      solution: '546371892793682514218945673937216458485793126162854739621437985359168247874529361'
    }
  ],
  medium: [
    {
      puzzle: '300200000000107000706030500070009080900020004010800050009040301000702000000008006',
      solution: '351286497492157638786934512275469183938521764614873259829645371163792845547318926'
    },
    {
      puzzle: '200080300060070084030500209000105408000000000402706000301007040720040060004010003',
      solution: '245981376169273584837564219976125438513498627482736951391657842728349165654812793'
    },
    {
      puzzle: '400300000000208000807040600080001090100030005020900060001050402000803000000009007',
      solution: '462397518513268749897145623386571294149632875725984361931756482274813956658429137'
    },
    {
      puzzle: '300090400070080095040600301000206509000000000503807000402008050830050070005020004',
      solution: '356192487271384695948675321187236549624519738593847162412768953839451276765923814'
    }
  ],
  hard: [
    {
      puzzle: '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
      solution: '483651927659423187271795326168934752752816943394507619926178534834259761517362498'
    },
    {
      puzzle: '030000080009000500000704000020000090000090000040000070000301000001000200050000040',
      solution: '534219786279683514618754329723845196865197432941362875486931257391478265157526943'
    },
    {
      puzzle: '000000108000530290000806037200105000060000050000608001130209000045061000608000000',
      solution: '594762138761534298382816437279145863863927154415608721137289645945361872628473519'
    },
    {
      puzzle: '000000103000680920000305084900106000050000060000503001180902000076051000503000000',
      solution: '627459183451687923839315784942176358358294167716503491184932576276851349593748612'
    }
  ],
  oni: [
    {
      puzzle: '000000000000003085001020000000507000004000100090000000500000073002010000000040009',
      solution: '987654321246193785351728694123567948674289153895431267519846273432917586768345219'
    },
    {
      puzzle: '000900800128006400070800060800430007500000009700068003090002030003500274004007000',
      solution: '346975812128346459975821364861439527532714689749268143497182536613593274284657391'
    },
    {
      puzzle: '000000000000004096002030000000608000005000200010000000600000084003020000000050001',
      solution: '198765432357214896462839715234678159785391264916542378621957384543128697879456321'
    },
    {
      puzzle: '000000000000007025009080000000503000006000900010000000500000037008090000000060001',
      solution: '123456789864917325759382416987543162436821957215679843591264837678193524342765891'
    }
  ]
};

function buildOrder(groupShift: number, innerShift: number): number[] {
  return Array.from({ length: 9 }, (_, idx) => ((Math.floor(idx / 3) + groupShift) % 3) * 3 + ((idx % 3) + innerShift) % 3);
}

function remapDigit(ch: string, digitShift: number): string {
  if (ch === '0') return ch;
  const digit = Number(ch);
  return String(((digit + digitShift - 1) % 9) + 1);
}

function transformGrid(grid: string, variant: Variant): string {
  const rowOrder = buildOrder(variant.bandShift, variant.rowShift);
  const colOrder = buildOrder(variant.stackShift, variant.colShift);
  const out: string[] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const sourceR = rowOrder[variant.transpose ? c : r];
      const sourceC = colOrder[variant.transpose ? r : c];
      const ch = grid[sourceR * 9 + sourceC];
      out.push(remapDigit(ch, variant.digitShift));
    }
  }

  return out.join('');
}

function expandSeeds(difficulty: Difficulty, seeds: PuzzleSeed[]): Puzzle[] {
  const expanded = seeds.flatMap((seed, seedIndex) =>
    variants.map((variant, variantIndex) => ({
      id: `${difficulty}-${seedIndex + 1}-${variantIndex + 1}`,
      puzzle: transformGrid(seed.puzzle, variant),
      solution: transformGrid(seed.solution, variant)
    }))
  );

  return expanded;
}

const bank: Record<Difficulty, Puzzle[]> = {
  easy: expandSeeds('easy', seedBank.easy),
  medium: expandSeeds('medium', seedBank.medium),
  hard: expandSeeds('hard', seedBank.hard),
  oni: expandSeeds('oni', seedBank.oni)
};

export function getRandomPuzzle(difficulty: Difficulty, recentPuzzleIds: string[] = []): Puzzle {
  const list = bank[difficulty];
  const recent = new Set(recentPuzzleIds);
  const candidateList = list.filter((puzzle) => !recent.has(puzzle.id));
  const source = candidateList.length > 0 ? candidateList : list;
  const selected = source[Math.floor(Math.random() * source.length)];

  console.info(
    `[puzzle/select] difficulty=${DIFFICULTY_LABEL[difficulty]} id=${selected.id} candidates=${source.length}/${list.length}`
  );

  return selected;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDailyPuzzle(difficulty: Difficulty, dateSeed: string): Puzzle {
  const list = bank[difficulty];
  const seed = `${difficulty}:${dateSeed}`;
  const index = hashSeed(seed) % list.length;
  const selected = list[index];
  console.info(`[puzzle/daily] difficulty=${DIFFICULTY_LABEL[difficulty]} date=${dateSeed} id=${selected.id}`);
  return selected;
}

export function pushRecentPuzzleId(recentPuzzleIds: string[], puzzleId: string): string[] {
  const next = recentPuzzleIds.filter((id) => id !== puzzleId);
  next.push(puzzleId);
  if (next.length > RECENT_PUZZLE_QUEUE_SIZE) {
    next.splice(0, next.length - RECENT_PUZZLE_QUEUE_SIZE);
  }
  return next;
}
