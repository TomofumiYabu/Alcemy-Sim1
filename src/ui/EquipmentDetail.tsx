import { equipmentTypes, items, recipes } from '../game/content';
import {
  getCraftPreview,
  missingMaterials,
  recipeTicks,
  replacementReason,
  unlocked,
} from '../game/engine';
import { recipeIds } from '../game/types';
import type { Equipment, RecipeId } from '../game/types';
import { seconds } from './format';
import type { Navigate, PanelProps } from './types';
import { EquipmentArtwork, ItemArtwork } from './Artwork';
import type { ItemId } from '../game/types';

export function EquipmentDetail({
  state,
  send,
  equipment,
  onMove,
  navigate,
  disabled,
}: PanelProps & {
  equipment: Equipment;
  onMove: () => void;
  navigate: Navigate;
  disabled: boolean;
}) {
  const preview = getCraftPreview(state, equipment.recipe);
  const targetKind = equipment.kind === 'cauldron' ? 'still' : 'cauldron';
  const target = equipmentTypes[targetKind];
  const exchangeReason = replacementReason(state, equipment.id, targetKind);
  return (
    <fieldset
      className="game-controls equipment-detail"
      data-testid="equipment-detail"
      disabled={disabled}
    >
      <div className="detail-heading">
        <h3>
          {equipmentTypes[equipment.kind].name} <span>#{equipment.id}</span>
        </h3>
        <EquipmentArtwork equipment={equipment} />
      </div>
      <label className="select-label">
        合成するレシピ
        <select
          aria-label="合成するレシピ"
          disabled={equipment.job !== null}
          value={equipment.recipe}
          onChange={(event) =>
            send({
              type: 'recipe',
              id: equipment.id,
              recipe: event.target.value as RecipeId,
            })
          }
        >
          {recipeIds
            .filter((id) => recipes[id].kind === equipment.kind)
            .map((id) => (
              <option
                key={id}
                value={id}
                disabled={!unlocked(state, recipes[id].requires)}
              >
                {recipes[id].name}
                {unlocked(state, recipes[id].requires) ? '' : '（研究で解放）'}
              </option>
            ))}
        </select>
      </label>
      <div className="recipe-formula">
        {Object.entries(recipes[equipment.recipe].inputs).map(([id, count]) => (
          <span className="recipe-ingredient" key={id}>
            <ItemArtwork item={id as ItemId} />
            <span>
              {items[id as ItemId].name} ×{count}
            </span>
          </span>
        ))}
        <span className="recipe-arrow" aria-hidden="true">
          →
        </span>
        <span className="recipe-ingredient">
          <ItemArtwork item={equipment.recipe} />
          <span>{recipes[equipment.recipe].name} ×1</span>
        </span>
      </div>
      <div className="production-meta">
        <span>
          ◷{' '}
          {seconds(
            equipment.job?.total ?? recipeTicks(state, equipment.recipe),
          )}{' '}
          / 個
        </span>
        <span>✧ 知識 +{equipment.job?.knowledge ?? preview.knowledge}</span>
      </div>
      {equipment.job ? (
        <>
          <progress
            aria-label="選択中の設備の合成進捗"
            max={equipment.job.total}
            value={equipment.job.total - equipment.job.remaining}
          />
          <p className="production-status">
            {equipment.enabled ? '合成中' : '仕上げ中（次の合成は停止）'} · あと
            {seconds(equipment.job.remaining)}
            {equipment.job.total !== recipeTicks(state, equipment.recipe) &&
              '（開始時の速度）'}
          </p>
          <small className="muted">合成が終わるとレシピを変更できます。</small>
        </>
      ) : (
        <p className="production-status">
          {!equipment.enabled
            ? '停止中 · 開始すると素材を使って繰り返し合成します'
            : missingMaterials(state, equipment).length
              ? `素材待ち：${missingMaterials(state, equipment).join(' / ')} 不足`
              : '次の合成を準備しています'}
        </p>
      )}
      <button
        className={`craft-toggle ${equipment.enabled ? 'secondary wide' : 'primary wide'}`}
        onClick={() => send({ type: 'toggle', id: equipment.id })}
      >
        {equipment.enabled ? '次の合成を停止' : '自動合成を開始'}
      </button>
      {!equipment.job &&
        equipment.enabled &&
        missingMaterials(state, equipment).length > 0 && (
          <button
            className="subtle wide"
            onClick={() => navigate('expeditions')}
          >
            素材を集める · 冒険者を開く →
          </button>
        )}
      <details className="equipment-replacement">
        <summary>移動・管理</summary>
        <button className="secondary wide" onClick={onMove}>
          この設備を移動
        </button>
        <button
          className="secondary wide"
          aria-label={`${target.name}へ交換`}
          disabled={exchangeReason !== null}
          onClick={() =>
            send({ type: 'replace', id: equipment.id, kind: targetKind })
          }
        >
          {target.name}へ交換 · {target.price}金貨
        </button>
        <small className="muted">
          {exchangeReason ??
            '同じマスで交換します。元の設備の返金はありません。'}
        </small>
      </details>
    </fieldset>
  );
}
