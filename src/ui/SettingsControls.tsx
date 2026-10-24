import type { usePreferences } from './usePreferences';
export function SettingsControls({
  ui,
  soundUnavailable,
}: {
  ui: ReturnType<typeof usePreferences>;
  soundUnavailable: boolean;
}) {
  const { preferences, updatePreferences, reduceMotion, error } = ui;
  return (
    <div className="display-settings">
      <h3>表示と通知</h3>
      <label className="checkbox-label motion-setting">
        <input
          type="checkbox"
          checked={reduceMotion}
          onChange={(event) =>
            updatePreferences({
              motion: event.target.checked ? 'reduced' : 'full',
            })
          }
        />
        動きを控えめにする
      </label>
      <button
        className="subtle wide"
        onClick={() => updatePreferences({ motion: 'system' })}
      >
        動きを端末の設定に合わせる
        {preferences.motion === 'system' ? '（使用中）' : ''}
      </button>
      <label className="select-label">
        文字の大きさ
        <select
          aria-label="文字の大きさ"
          value={preferences.textSize}
          onChange={(event) =>
            updatePreferences({
              textSize: event.target.value as typeof preferences.textSize,
            })
          }
        >
          <option value="standard">標準</option>
          <option value="large">大きめ（112.5%）</option>
          <option value="largest">最大（125%）</option>
        </select>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={preferences.notifications}
          onChange={(event) =>
            updatePreferences({ notifications: event.target.checked })
          }
        />
        出来事の通知を表示する
      </label>
      <h3>音</h3>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={preferences.sound}
          onChange={(event) =>
            updatePreferences({ sound: event.target.checked })
          }
        />
        出来事の音を鳴らす
      </label>
      <label className="volume-setting">
        音量 {preferences.volume}%
        <input
          aria-label="音量"
          type="range"
          min="0"
          max="100"
          value={preferences.volume}
          onChange={(event) =>
            updatePreferences({ volume: Number(event.target.value) })
          }
        />
      </label>
      <small className="muted">
        音は初期状態でオフです。有効にした後の操作から、合成・帰還・販売・研究の完了を短い音で知らせます。
      </small>
      {soundUnavailable && (
        <p role="status">
          このブラウザーでは音を再生できません。出来事は画面の表示と記録で確認できます。
        </p>
      )}
      <small className="muted">
        これらの設定は工房の記録とは別に、このブラウザーへ保存します。
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
