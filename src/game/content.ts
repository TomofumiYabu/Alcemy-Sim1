import type {
  AdventurerId,
  DestinationId,
  EquipmentKind,
  ItemId,
  RecipeId,
  ResearchId,
} from './types';
import { currentRules } from './contentVersions';

export const items: Record<
  ItemId,
  { name: string; icon: string; price: number; category: string }
> = {
  herb: { name: '薬草', icon: '✿', price: 0, category: '素材' },
  water: { name: '清水', icon: '◈', price: 0, category: '素材' },
  crystal: { name: '魔晶片', icon: '✧', price: 0, category: '素材' },
  potion: { name: '傷薬', icon: '⚱', price: 12, category: '製品' },
  extract: {
    name: '薬草エキス',
    icon: '♧',
    price: 16,
    category: '中間素材・製品',
  },
  mana: { name: '魔力薬', icon: '✦', price: 40, category: '製品' },
};
export const recipes: Record<
  RecipeId,
  {
    name: string;
    kind: EquipmentKind;
    inputs: Partial<Record<ItemId, number>>;
    ticks: number;
    knowledge: number;
    requires: ResearchId | null;
  }
> = {
  potion: {
    name: '傷薬',
    kind: 'cauldron',
    inputs: { herb: 2, water: 1 },
    ...currentRules.recipes.potion,
    requires: null,
  },
  extract: {
    name: '薬草エキス',
    kind: 'still',
    inputs: { herb: 3 },
    ...currentRules.recipes.extract,
    requires: 'production-2',
  },
  mana: {
    name: '魔力薬',
    kind: 'cauldron',
    inputs: { extract: 1, crystal: 1, water: 1 },
    ...currentRules.recipes.mana,
    requires: 'knowledge-2',
  },
};
export const equipmentTypes: Record<
  EquipmentKind,
  {
    name: string;
    icon: string;
    price: number;
    recipe: RecipeId;
    requires: ResearchId | null;
  }
> = {
  cauldron: {
    name: '調合釜',
    icon: '♨',
    price: 25,
    recipe: 'potion',
    requires: null,
  },
  still: {
    name: '蒸留器',
    icon: '♜',
    price: 45,
    recipe: 'extract',
    requires: 'production-2',
  },
};
export const adventurerTypes: Record<
  AdventurerId,
  { name: string; title: string; price: number; initials: string }
> = {
  iris: { name: 'イリス', title: '森を知る採集家', price: 20, initials: 'I' },
  rowan: {
    name: 'ローワン',
    title: '遺跡を歩く旅人',
    price: 40,
    initials: 'R',
  },
};
export const destinations: Record<
  DestinationId,
  {
    name: string;
    ticks: number;
    rewards: Partial<Record<ItemId, number>>;
    requires: ResearchId | null;
  }
> = {
  forest: {
    name: 'ささやきの森',
    ...currentRules.destinations.forest,
    requires: null,
  },
  ruins: {
    name: '月影の遺跡',
    ...currentRules.destinations.ruins,
    requires: 'gathering-3',
  },
};
type Research = {
  name: string;
  branch: string;
  description: string;
  gold: number;
  knowledge: number;
  requires: ResearchId[];
};
export const research: Record<ResearchId, Research> = {
  'gathering-1': {
    name: '森の恵み',
    branch: '採集',
    description: '森で持ち帰る薬草 +1',
    gold: 20,
    knowledge: 3,
    requires: [],
  },
  'gathering-2': {
    name: '帰り道の約束',
    branch: '採集',
    description: '冒険者の自動再派遣を解放',
    gold: 40,
    knowledge: 6,
    requires: ['gathering-1'],
  },
  'gathering-3': {
    name: '月影への地図',
    branch: '採集',
    description: '魔晶片が採れる遺跡を解放',
    gold: 60,
    knowledge: 9,
    requires: ['gathering-2'],
  },
  'production-1': {
    name: '火加減の心得',
    branch: '生産',
    description: '合成時間を10%短縮',
    gold: 20,
    knowledge: 3,
    requires: [],
  },
  'production-2': {
    name: '蒸留の技法',
    branch: '生産',
    description: '蒸留器と薬草エキスを解放',
    gold: 40,
    knowledge: 6,
    requires: ['production-1'],
  },
  'production-3': {
    name: '淀みなき調合',
    branch: '生産',
    description: '合成時間を合計20%短縮',
    gold: 60,
    knowledge: 9,
    requires: ['production-2'],
  },
  'knowledge-1': {
    name: '観察の手帳',
    branch: '知識',
    description: '合成で得られる知識 +1',
    gold: 20,
    knowledge: 3,
    requires: [],
  },
  'knowledge-2': {
    name: '魔力を結ぶ式',
    branch: '知識',
    description: '魔力薬のレシピを解放',
    gold: 60,
    knowledge: 9,
    requires: ['knowledge-1', 'gathering-3', 'production-2'],
  },
  'knowledge-3': {
    name: '工房の名声',
    branch: '知識',
    description: '製品の販売価格 +20%',
    gold: 100,
    knowledge: 15,
    requires: ['knowledge-2'],
  },
};
