import {
  getCraftPreview,
  getExpeditionPreview,
  salePrice,
} from '../game/engine';
import type { GameState, ResearchId } from '../game/types';
import { seconds } from './format';
import type { GuidedAction } from './navigation';
import type { IconName } from './Icon';

export const researchIcons: Record<ResearchId, IconName> = {
  'gathering-1': 'leaf',
  'gathering-2': 'route',
  'gathering-3': 'adventurers',
  'production-1': 'clock',
  'production-2': 'research',
  'production-3': 'clock',
  'knowledge-1': 'book',
  'knowledge-2': 'knowledge',
  'knowledge-3': 'coin',
};
export function researchExample(state: GameState, id: ResearchId): string {
  const next = state.research.includes(id)
    ? state
    : { ...state, research: [...state.research, id] };
  if (id === 'production-1' || id === 'production-3')
    return `傷薬 ${seconds(getCraftPreview(state, 'potion').total)} → ${seconds(getCraftPreview(next, 'potion').total)}`;
  if (id === 'gathering-1')
    return `森の薬草 ${getExpeditionPreview(state, 'forest').rewards.herb} → ${getExpeditionPreview(next, 'forest').rewards.herb}個`;
  if (id === 'knowledge-1')
    return `傷薬1回の知識 ${getCraftPreview(state, 'potion').knowledge} → ${getCraftPreview(next, 'potion').knowledge}`;
  if (id === 'knowledge-3')
    return `傷薬の売価 ${salePrice(state, 'potion')} → ${salePrice(next, 'potion')}金貨`;
  if (id === 'gathering-2') return '帰還後、選んだ探索先へ自動で再出発';
  if (id === 'gathering-3') return '遺跡から魔晶片と清水を調達';
  if (id === 'production-2') return '薬草からエキスを作る生産工程が開く';
  return '薬草エキスと魔晶片から魔力薬を合成';
}
export const researchAction: Partial<Record<ResearchId, GuidedAction>> = {
  'gathering-2': {
    navigation: { screen: 'expeditions' },
    label: '自動再派遣を設定する',
  },
  'gathering-3': {
    navigation: {
      screen: 'expeditions',
      target: { type: 'destination', destination: 'ruins' },
    },
    label: '遺跡への派遣を開く',
  },
  'production-2': {
    navigation: {
      screen: 'workshop',
      target: { type: 'purchase', kind: 'still' },
    },
    label: '蒸留器の配置を開く',
  },
  'knowledge-2': {
    navigation: {
      screen: 'workshop',
      target: { type: 'equipment', kind: 'cauldron' },
    },
    label: '釜で魔力薬を作る',
  },
};
